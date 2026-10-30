const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
const rawScript = scriptMatch[1];
const scriptSha256 = crypto.createHash('sha256').update(rawScript, 'utf8').digest('base64');

const exposedScript = rawScript.replace(
  'showBanner();\nrender();\n})();',
  `window.__ZF_TEST__ = {
    esc, clone, uid, p2, isStrictNum, num, clamp, str, getPath, setPath,
    todayISO, parseISO, addDays, daysBetween, fmtDate, fmtMoney, toMinor,
    calc, lineAmt, isPartial, isOverdue, effStatus,
    img, normSettings, normPayment, normInvoice, migratePayload, loadState, persist,
    saveSnapshot, getSnapshot, restoreSnapshot, recordPaymentOnInvoice, applyBackupImport,
    makeNumber, newInvoice, renderPaper, getClientGroups, totalsBy,
    validate, csvCell, reminderText, S, ui, CURRENCIES, T, SCHEMA_VERSION,
    generateUpiURI, generateZatcaTLV, QRCodeEngine,
    addRecurringDate, processRecurringInvoices
  };
})();`
);

function createSandbox(initialStorage = {}) {
  const store = Object.assign({}, initialStorage);
  const elements = {};
  function getElem(id) {
    if (!elements[id]) {
      elements[id] = {
        id, value: '', innerHTML: '', textContent: '', style: {}, classList: new Set(),
        addEventListener: () => {}, removeEventListener: () => {}, setAttribute: () => {}, getAttribute: () => null,
        appendChild: () => {}, querySelector: () => null, querySelectorAll: () => [],
        focus: () => {}, blur: () => {}
      };
    }
    return elements[id];
  }
  const sandbox = {
    console,
    window: {
      addEventListener: () => {}, removeEventListener: () => {},
      localStorage: {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; }
      },
      matchMedia: () => ({ matches: false, addEventListener: () => {} }),
      location: { reload: () => {} },
      setTimeout, clearTimeout,
      requestAnimationFrame: (cb) => setTimeout(cb, 0),
      cancelAnimationFrame: (id) => clearTimeout(id)
    },
    document: {
      documentElement: { setAttribute: () => {}, classList: new Set() },
      title: 'ZestFlow',
      getElementById: getElem,
      querySelector: (sel) => getElem(sel.replace(/^[#.]/, '')),
      querySelectorAll: () => [],
      addEventListener: () => {}
    },
    TextEncoder,
    btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
    atob: (b64) => Buffer.from(b64, 'base64').toString('binary')
  };
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox);
  vm.runInContext(exposedScript, sandbox);
  return { zf: sandbox.window.__ZF_TEST__, store };
}

const results = [];
function runTest(id, name, desc, fn) {
  try {
    const res = fn();
    results.push({ id, name, desc, pass: !!res.pass, actual: res.actual, expected: res.expected });
  } catch (e) {
    results.push({ id, name, desc, pass: false, actual: 'ERROR: ' + e.message, expected: 'No error' });
  }
}

console.log('=== MODULE 2: RECURRING INVOICES & RETAINER ENGINE VERIFICATION ===');

runTest('MOD2-01', 'Recurring Date Math', 'addRecurringDate advances weekly (+7d), monthly (+1m), quarterly (+3m), and yearly (+1y)', () => {
  const { zf } = createSandbox();
  const w = zf.addRecurringDate('2026-03-01', 'weekly');
  const m = zf.addRecurringDate('2026-03-01', 'monthly');
  const q = zf.addRecurringDate('2026-03-01', 'quarterly');
  const y = zf.addRecurringDate('2026-03-01', 'yearly');
  const pass = w === '2026-03-08' && m === '2026-04-01' && q === '2026-06-01' && y === '2027-03-01';
  return { pass, actual: `w=${w}, m=${m}, q=${q}, y=${y}`, expected: 'w=2026-03-08, m=2026-04-01, q=2026-06-01, y=2027-03-01' };
});

runTest('MOD2-02', 'Recurring Profile Normalization', 'normInvoice assigns normalized recurring structure with enabled, frequency, status, and nextIssue', () => {
  const { zf } = createSandbox();
  const inv = zf.normInvoice({
    issue: '2026-05-10',
    recurring: { enabled: true, frequency: 'monthly', status: 'active' }
  });
  const pass = inv.recurring.enabled === true && inv.recurring.frequency === 'monthly' && inv.recurring.status === 'active' && inv.recurring.nextIssue === '2026-06-10';
  return { pass, actual: JSON.stringify(inv.recurring), expected: 'Normalized recurring profile with nextIssue=2026-06-10' };
});

runTest('MOD2-03', 'Recurring Auto-Generation Trigger', 'processRecurringInvoices generates cloned draft invoice when nextIssue <= today', () => {
  const { zf } = createSandbox();
  const parent = zf.normInvoice({
    id: 'parent_rec_1',
    number: 'INV-100',
    issue: '2026-01-01',
    due: '2026-01-15',
    status: 'paid',
    client: { name: 'Acme Retainer Corp' },
    items: [{ desc: 'Monthly SEO Retainer', qty: '1', rate: '1500' }],
    recurring: { enabled: true, frequency: 'monthly', nextIssue: '2026-02-01', status: 'active' }
  });
  zf.S.invoices = [parent];
  const count = zf.processRecurringInvoices('2026-02-01');
  const pass = count === 1 && zf.S.invoices.length === 2;
  const child = zf.S.invoices[0];
  const validChild = child.status === 'draft' && child.issue === '2026-02-01' && child.due === '2026-02-15' && child.payments.length === 0 && child.recurring.enabled === false;
  return { pass: pass && validChild, actual: `count=${count}, childStatus=${child ? child.status : 'none'}, nextParentRun=${parent.recurring.nextIssue}`, expected: 'count=1, childStatus=draft, nextParentRun=2026-03-01' };
});

runTest('MOD2-04', 'Cycle Advancement', 'Parent recurring template nextIssue is advanced to next cycle after generation', () => {
  const { zf } = createSandbox();
  const parent = zf.normInvoice({
    id: 'parent_cycle',
    issue: '2026-02-01',
    recurring: { enabled: true, frequency: 'monthly', nextIssue: '2026-02-01', status: 'active' }
  });
  zf.S.invoices = [parent];
  zf.processRecurringInvoices('2026-02-01');
  const pass = parent.recurring.nextIssue === '2026-03-01';
  return { pass, actual: parent.recurring.nextIssue, expected: '2026-03-01' };
});

runTest('MOD2-05', 'Paused Schedule Safety', 'Paused recurring profile (status: "paused") does not generate invoices', () => {
  const { zf } = createSandbox();
  const parent = zf.normInvoice({
    id: 'parent_paused',
    recurring: { enabled: true, frequency: 'monthly', nextIssue: '2026-01-01', status: 'paused' }
  });
  zf.S.invoices = [parent];
  const count = zf.processRecurringInvoices('2026-02-01');
  const pass = count === 0 && zf.S.invoices.length === 1;
  return { pass, actual: `count=${count}, invoicesCount=${zf.S.invoices.length}`, expected: 'count=0, no auto-generation' };
});

runTest('MOD2-06', 'Disabled Schedule Safety', 'Disabled recurring profile (enabled: false) does not generate invoices', () => {
  const { zf } = createSandbox();
  const parent = zf.normInvoice({
    id: 'parent_disabled',
    recurring: { enabled: false, nextIssue: '2026-01-01' }
  });
  zf.S.invoices = [parent];
  const count = zf.processRecurringInvoices('2026-02-01');
  const pass = count === 0 && zf.S.invoices.length === 1;
  return { pass, actual: `count=${count}`, expected: 'count=0' };
});

runTest('MOD2-07', 'Module 1 Regression Check', 'UPI URI, ZATCA TLV and QR code generation still functional after Module 2 addition', () => {
  const { zf } = createSandbox();
  const uri = zf.generateUpiURI('ali@upi', 'Ali', 5000, 'INV-1');
  const b64 = zf.generateZatcaTLV('Ali', '300000000000003', '2026-01-01T00:00:00Z', '100.00', '15.00');
  const svg = zf.QRCodeEngine.toSVG('test', 64);
  const pass = uri.includes('upi://') && b64.length > 20 && svg.includes('<svg');
  return { pass, actual: `uri=${uri.length>0}, b64=${b64.length>0}, svg=${svg.length>0}`, expected: 'All Module 1 helpers functional' };
});

runTest('MOD2-08', 'CSP Security Lockdown', 'CSP meta tag in index.html matches exact script SHA-256 hash with zero unsafe-inline in script-src', () => {
  const expectedToken = `script-src 'sha256-${scriptSha256}'`;
  const scriptSrcUnsafe = /script-src[^;]*unsafe-inline/i.test(html);
  const pass = html.includes(expectedToken) && !scriptSrcUnsafe;
  return { pass, actual: `hasExactHash=${html.includes(expectedToken)}, scriptSrcUnsafe=${scriptSrcUnsafe}`, expected: 'Exact hash-locked CSP without unsafe-inline in script-src' };
});

let passed = 0;
results.forEach(r => {
  if (r.pass) passed++;
  console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.id}: ${r.name} - ${r.desc}`);
  if (!r.pass) {
    console.log(`   Actual:   ${r.actual}`);
    console.log(`   Expected: ${r.expected}`);
  }
});

console.log(`\nSummary: ${passed}/${results.length} Module 2 tests passed.`);
process.exit(passed === results.length ? 0 : 1);
