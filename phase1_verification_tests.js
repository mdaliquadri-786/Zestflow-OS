const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const filePath = path.join(__dirname, 'zestflow-v2.html');
const rollbackPath = path.join(__dirname, 'zestflow-v2.phase0-baseline.html');

const html = fs.readFileSync(filePath, 'utf8');
const sha256 = crypto.createHash('sha256').update(html).digest('hex');
const rollbackSha = crypto.createHash('sha256').update(fs.readFileSync(rollbackPath, 'utf8')).digest('hex');

console.log('=== PHASE 1 (P0 FINANCIAL ENGINE & DATA SAFETY) VERIFICATION SUITE ===');
console.log('Active Application:', filePath);
console.log('Active SHA-256:', sha256);
console.log('Phase 0 Untouched Rollback SHA-256:', rollbackSha);

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error('FATAL: No <script> tag found');
  process.exit(1);
}
const rawScript = scriptMatch[1];

const exposedScript = rawScript.replace(
  'showBanner();\nrender();\n})();',
  `window.__ZF_TEST__ = {
    esc, clone, uid, p2, isStrictNum, num, clamp, str, getPath, setPath,
    todayISO, parseISO, addDays, daysBetween, fmtDate, fmtMoney, toMinor,
    calc, lineAmt, isPartial, isOverdue, effStatus,
    img, normSettings, normPayment, normInvoice, migratePayload, loadState, persist,
    saveSnapshot, getSnapshot, restoreSnapshot, recordPaymentOnInvoice, applyBackupImport,
    makeNumber, newInvoice, renderPaper, getClientGroups, totalsBy,
    validate, csvCell, reminderText, S, ui, CURRENCIES, T, SCHEMA_VERSION
  };
})();`
);

function createSandbox(initialStorage = {}) {
  const store = Object.assign({}, initialStorage);
  const listeners = {};
  const elements = {};
  const makeEl = () => ({
    innerHTML: '', textContent: '', value: '', href: '', style: {},
    setAttribute() {}, removeAttribute() {}, toggleAttribute() {},
    addEventListener() {}, appendChild() {}, querySelector() { return makeEl(); },
    querySelectorAll() { return []; }, close() {}, showModal() {},
    classList: { toggle() {}, add() {}, remove() {} }
  });
  const sandbox = {
    window: {
      devicePixelRatio: 1,
      addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
      dispatchEvent(ev, payload) { (listeners[ev] || []).forEach(fn => fn(payload)); },
      scrollTo() {},
      print() {}
    },
    document: {
      title: 'ZestFlow',
      querySelector(sel) { return elements[sel] || (elements[sel] = makeEl()); },
      querySelectorAll() { return []; },
      createElement() { return makeEl(); },
      addEventListener() {},
      body: makeEl()
    },
    localStorage: {
      getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; }
    },
    history: { replaceState() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    ResizeObserver: class { observe() {} disconnect() {} },
    FileReader: class { readAsDataURL() {} readAsText() {} },
    Image: class {},
    Blob: class {},
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
    Intl, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Map, Set, Promise,
    parseFloat, setTimeout, clearTimeout, requestAnimationFrame: fn => fn(), cancelAnimationFrame: () => {}
  };
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox);
  vm.runInContext(exposedScript, sandbox);
  return { zf: sandbox.window.__ZF_TEST__, store, elements, window: sandbox.window };
}

const results = [];
function runTest(id, category, description, fn) {
  try {
    const out = fn();
    results.push({ id, category, description, pass: !!out.pass, actual: out.actual, expected: out.expected });
  } catch (err) {
    results.push({ id, category, description, pass: false, actual: 'ERROR: ' + err.message, expected: 'No error' });
  }
}

// P1-01: Fix BASE-02 (3-decimal unit rate precision: qty 1000 * rate 0.125 = $125.00)
runTest('P1-01', 'Financial (BASE-02 Fix)', '3-decimal unit rate precision (qty 1000 * rate 0.125 = 12500 minor units / $125.00)', () => {
  const { zf } = createSandbox();
  const inv = zf.normInvoice({ discount: '0', taxRate: '0', items: [{ desc: 'API calls', qty: '1000', rate: '0.125' }] });
  const c = zf.calc(inv);
  return { pass: c.sub === 12500 && c.total === 12500, actual: `sub=${c.sub}, total=${c.total}`, expected: 'sub=12500, total=12500' };
});

// P1-02: Fix BASE-03 (Strict numeric validation rejects partial strings like "12abc")
runTest('P1-02', 'Financial (BASE-03 Fix)', 'Strict numeric validation rejects malformed strings like "12abc" in qty/rate/tax/discount', () => {
  const { zf } = createSandbox();
  const inv = zf.normInvoice({ client: { name: 'Acme' }, number: 'INV-0001', items: [{ desc: 'Dev', qty: '12abc', rate: '100' }] });
  const errs = zf.validate(inv);
  return {
    pass: !zf.isStrictNum('12abc') && zf.num('12abc') === 0 && errs.some(e => e.includes('valid numbers')),
    actual: `isStrictNum('12abc')=${zf.isStrictNum('12abc')}, errs=${JSON.stringify(errs)}`,
    expected: 'isStrictNum("12abc")=false and validation error reported'
  };
});

// P1-03: Fix BASE-08 (Strict calendar validation in parseISO rejects 2026-02-31)
runTest('P1-03', 'Calendar (BASE-08 Fix)', 'parseISO("2026-02-31") returns null instead of rolling over to March 3', () => {
  const { zf } = createSandbox();
  const feb31 = zf.parseISO('2026-02-31');
  const leap2024 = zf.parseISO('2024-02-29');
  const nonLeap2026 = zf.parseISO('2026-02-29');
  return {
    pass: feb31 === null && leap2024 !== null && nonLeap2026 === null,
    actual: `parseISO('2026-02-31')=${feb31}, parseISO('2024-02-29')=${leap2024 ? 'valid' : null}, parseISO('2026-02-29')=${nonLeap2026}`,
    expected: '2026-02-31=null, 2024-02-29=valid, 2026-02-29=null'
  };
});

// P1-04: GST Intra-State (CGST + SGST) vs Inter-State (IGST)
runTest('P1-04', 'GST Regime (India)', 'Intra-state (Telangana -> Telangana) splits 18% into CGST 9% + SGST 9%; Inter-state (Telangana -> Maharashtra) uses IGST 18%', () => {
  const { zf } = createSandbox();
  const intra = zf.normInvoice({
    currency: 'INR', taxRegime: 'gst_in', supplierState: 'Telangana', placeOfSupply: 'Telangana',
    taxRate: '18', items: [{ desc: 'SaaS Build', qty: '1', rate: '10000' }]
  });
  const inter = zf.normInvoice({
    currency: 'INR', taxRegime: 'gst_in', supplierState: 'Telangana', placeOfSupply: 'Maharashtra',
    taxRate: '18', items: [{ desc: 'SaaS Build', qty: '1', rate: '10000' }]
  });
  const cIntra = zf.calc(intra);
  const cInter = zf.calc(inter);
  return {
    pass: cIntra.gstMode === 'intra' && cIntra.cgst === 90000 && cIntra.sgst === 90000 && cIntra.igst === 0 &&
          cInter.gstMode === 'inter' && cInter.igst === 180000 && cInter.cgst === 0 && cInter.sgst === 0,
    actual: `Intra: mode=${cIntra.gstMode}, cgst=${cIntra.cgst}, sgst=${cIntra.sgst} | Inter: mode=${cInter.gstMode}, igst=${cInter.igst}`,
    expected: 'Intra: cgst=90000, sgst=90000 | Inter: igst=180000'
  };
});

// P1-05: Tax-Inclusive Pricing & Fixed-Amount Discount & Nearest-Unit Rounding
runTest('P1-05', 'Tax-Inclusive & Fixed Discount', 'Tax-inclusive 18% on ₹1,180.00 extracts ₹1,000.00 taxable + ₹180.00 tax; fixed discount & nearest-unit rounding work accurately', () => {
  const { zf } = createSandbox();
  const incl = zf.normInvoice({
    currency: 'INR', taxMode: 'inclusive', taxRate: '18',
    items: [{ desc: 'Consulting', qty: '1', rate: '1180' }]
  });
  const cIncl = zf.calc(incl);
  const rounded = zf.normInvoice({
    currency: 'INR', taxMode: 'exclusive', discountType: 'fixed', discount: '50', taxRate: '18', roundingMode: 'nearest_unit',
    items: [{ desc: 'Item', qty: '1', rate: '103.25' }] // sub=10325, disc=5000, taxable=5325, tax=959, gross=6284 -> nearest_unit=6300 (delta +16)
  });
  const cRnd = zf.calc(rounded);
  return {
    pass: cIncl.taxable === 100000 && cIncl.tax === 18000 && cIncl.total === 118000 &&
          cRnd.disc === 5000 && cRnd.total === 6300 && cRnd.roundingDelta === 16,
    actual: `Incl: taxable=${cIncl.taxable}, tax=${cIncl.tax}, total=${cIncl.total} | Rounded: disc=${cRnd.disc}, delta=${cRnd.roundingDelta}, total=${cRnd.total}`,
    expected: 'Incl: taxable=100000, tax=18000, total=118000 | Rounded: disc=5000, delta=16, total=6300'
  };
});

// P1-06: Partial Payments, Refunds, Balance Due & Derived 'partial' Status
runTest('P1-06', 'Payments Ledger & Lifecycle', 'Partial payment transitions status to "partial", full payment transitions to "paid", and refund restores balance due', () => {
  const { zf } = createSandbox();
  const inv = zf.normInvoice({
    status: 'sent', issue: '2026-10-01', due: '2026-12-01', currency: 'USD',
    items: [{ desc: 'Retainer', qty: '1', rate: '1000' }]
  });
  zf.recordPaymentOnInvoice(inv, { type: 'payment', amount: '400', date: '2026-10-10', method: 'UPI' });
  const stAfterPartial = zf.effStatus(inv);
  const balAfterPartial = zf.calc(inv).balanceMinor;

  zf.recordPaymentOnInvoice(inv, { type: 'payment', amount: '600', date: '2026-10-15', method: 'Bank Transfer' });
  const stAfterFull = zf.effStatus(inv);
  const balAfterFull = zf.calc(inv).balanceMinor;

  zf.recordPaymentOnInvoice(inv, { type: 'refund', amount: '250', date: '2026-10-20', method: 'Bank Transfer' });
  const cAfterRefund = zf.calc(inv);
  return {
    pass: stAfterPartial === 'partial' && balAfterPartial === 60000 &&
          stAfterFull === 'paid' && balAfterFull === 0 &&
          cAfterRefund.netPaidMinor === 75000 && cAfterRefund.balanceMinor === 25000,
    actual: `after $400: status=${stAfterPartial}, bal=${balAfterPartial} | after +$600: status=${stAfterFull}, bal=${balAfterFull} | after -$250 refund: netPaid=${cAfterRefund.netPaidMinor}, bal=${cAfterRefund.balanceMinor}`,
    expected: 'after $400: partial (bal 60000) | after +$600: paid (bal 0) | after -$250 refund: netPaid 75000, bal 25000'
  };
});

// P1-07: v2 -> v3 Schema Migration & Rollback Snapshot Recovery
runTest('P1-07', 'Data Safety & Rollback', 'Legacy v2 paid invoice migrates cleanly to v3 with synthesized payment record, and pre-import snapshot restores 100% of prior state', () => {
  const legacyV2 = {
    settings: { business: { name: 'CodeWithAli v2' }, defaults: { currency: 'INR', lang: 'ur' } },
    invoices: [{ id: 'inv_legacy_1', number: 'INV-0001', status: 'paid', issue: '2026-10-01', due: '2026-10-15', paidDate: '2026-10-12', currency: 'INR', lang: 'ur', items: [{ desc: 'Design', qty: '1', rate: '5000' }] }]
  };
  const { zf } = createSandbox({ 'zestflow.v2': JSON.stringify(legacyV2) });
  const migratedInv = zf.S.invoices[0];
  const hadSynthesizedPayment = migratedInv.payments.length === 1 && migratedInv.payments[0].amountMinor === 500000;

  // Now import a replacement backup and verify snapshot undo restores CodeWithAli v2
  const newBackup = {
    settings: { business: { name: 'Overwritten Co' } },
    invoices: [{ id: 'inv_new_99', number: 'INV-0099', status: 'draft', items: [{ desc: 'New', qty: '1', rate: '100' }] }]
  };
  zf.applyBackupImport(newBackup, 'replace');
  const afterReplaceName = zf.S.settings.business.name;
  const restored = zf.restoreSnapshot();
  const afterUndoName = zf.S.settings.business.name;
  const afterUndoInvId = zf.S.invoices[0].id;

  return {
    pass: zf.S.schemaVersion === 3 && hadSynthesizedPayment && afterReplaceName === 'Overwritten Co' && restored && afterUndoName === 'CodeWithAli v2' && afterUndoInvId === 'inv_legacy_1',
    actual: `schemaVersion=${zf.S.schemaVersion}, synthesizedPay=${hadSynthesizedPayment}, replaced="${afterReplaceName}", restored="${afterUndoName}" (${afterUndoInvId})`,
    expected: 'schemaVersion=3, synthesizedPay=true, replaced="Overwritten Co", restored="CodeWithAli v2" (inv_legacy_1)'
  };
});

// P1-08: Preserve all 4 languages (en, ar, ur, te) & RTL/LTR rendering
runTest('P1-08', 'Multilingual Compatibility', 'All 4 languages (en, ar, ur, te) render with accurate dir="rtl"/"ltr" and GST/payment lines in renderPaper()', () => {
  const { zf } = createSandbox();
  const langs = ['en', 'ar', 'ur', 'te'];
  const dirs = langs.map(l => {
    const inv = zf.normInvoice({ lang: l, currency: 'INR', taxRegime: 'gst_in', supplierState: 'Telangana', placeOfSupply: 'Telangana', taxRate: '18', items: [{ desc: 'Test', qty: '1', rate: '1000' }] });
    const p = zf.renderPaper(inv, {});
    return p.includes(`lang="${l}"`) && p.includes(`dir="${l === 'ar' || l === 'ur' ? 'rtl' : 'ltr'}"`) && p.includes('CGST') && p.includes('SGST');
  });
  return {
    pass: dirs.every(Boolean),
    actual: `langsVerified=${JSON.stringify(dirs)}`,
    expected: 'langsVerified=[true,true,true,true]'
  };
});

console.log('\n--- PHASE 1 TEST RESULTS ---');
let passed = 0;
results.forEach(r => {
  if (r.pass) passed++;
  console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.id} (${r.category}): ${r.description}`);
  console.log(`   Actual:   ${r.actual}`);
  console.log(`   Expected: ${r.expected}`);
});
console.log(`\nSummary: ${passed}/${results.length} Phase 1 tests passed.`);
if (passed !== results.length) process.exit(1);