const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const filePath = path.join(__dirname, 'zestflow-v2.html');
const cspHardenedPath = path.join(__dirname, 'zestflow-v2.csp-hardened.html');

const html = fs.readFileSync(filePath, 'utf8');
const cspHardenedHtml = fs.readFileSync(cspHardenedPath, 'utf8');
const sha256 = crypto.createHash('sha256').update(html).digest('hex');

console.log('=== PHASES 2, 3 & 4 (P0 SECURITY/NUMBERING + P1 MULTILINGUAL/A11Y/THEMES + P2 CATALOG/AGEING) SUITE ===');
console.log('Active Application:', filePath);
console.log('Active SHA-256:', sha256);

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error('FATAL: No <script> tag found');
  process.exit(1);
}
const rawScript = scriptMatch[1];
const scriptSha256Base64 = crypto.createHash('sha256').update(rawScript, 'utf8').digest('base64');
console.log('Exact Inline Script SHA-256:', `'sha256-${scriptSha256Base64}'`);

const exposedScript = rawScript.replace(
  'showBanner();\nrender();\n})();',
  `window.__ZF_TEST__ = {
    esc, clone, uid, p2, isStrictNum, num, clamp, str, getPath, setPath,
    todayISO, parseISO, addDays, daysBetween, fmtDate, fmtMoney, toMinor,
    calc, lineAmt, isPartial, isOverdue, effStatus,
    fmtDigits, isValidE164Digits, verifyImageMagicBytes,
    img, normSettings, normPayment, normInvoice, migratePayload, loadState, persist,
    saveSnapshot, getSnapshot, restoreSnapshot, recordPaymentOnInvoice, applyBackupImport,
    applyTheme, logHistory, makeNumber, newInvoice, renderPaper, getClientGroups, totalsBy,
    computeAgeing, buildAgeingHTML, runBuiltInSelfTests,
    validate, csvCell, reminderText, S, ui, CURRENCIES, T, DOC_TYPES, SCHEMA_VERSION
  };
})();`
);

function createSandbox(initialStorage = {}) {
  const store = Object.assign({}, initialStorage);
  const docListeners = {};
  const elements = {};
  const docEl = {
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k]; }
  };
  const makeEl = () => ({
    innerHTML: '', textContent: '', value: '', href: '', title: '', style: {},
    setAttribute() {}, removeAttribute() {}, toggleAttribute() {},
    addEventListener() {}, appendChild() {}, querySelector() { return makeEl(); },
    querySelectorAll() { return []; }, close() {}, showModal() {},
    classList: { toggle() {}, add() {}, remove() {} }
  });
  const sandbox = {
    window: {
      devicePixelRatio: 1,
      addEventListener() {},
      scrollTo() {},
      print() {}
    },
    document: {
      title: 'ZestFlow',
      documentElement: docEl,
      querySelector(sel) { return elements[sel] || (elements[sel] = makeEl()); },
      querySelectorAll() { return []; },
      createElement() { return makeEl(); },
      addEventListener(ev, fn) { (docListeners[ev] = docListeners[ev] || []).push(fn); },
      dispatchKeydown(evObj) { (docListeners['keydown'] || []).forEach(fn => fn(evObj)); },
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
    FileReader: class { readAsDataURL() {} readAsText() {} readAsArrayBuffer() {} },
    Uint8Array, Image: class {}, Blob: class {},
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
    Intl, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Map, Set, Promise,
    parseFloat, setTimeout, clearTimeout, requestAnimationFrame: fn => fn(), cancelAnimationFrame: () => {}
  };
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox);
  vm.runInContext(exposedScript, sandbox);
  return { zf: sandbox.window.__ZF_TEST__, store, elements, document: sandbox.document, docEl };
}

const results = [];
function runTest(id, phase, description, fn) {
  try {
    const out = fn();
    results.push({ id, phase, description, pass: !!out.pass, actual: out.actual, expected: out.expected });
  } catch (err) {
    results.push({ id, phase, description, pass: false, actual: 'ERROR: ' + err.message, expected: 'No error' });
  }
}

// P2-01 (BASE-06 Fix): Hash-locked CSP without 'unsafe-inline' in script-src
runTest('P2-01', 'Phase 2 (Security / BASE-06)', 'Hash-locked CSP contains exact script SHA-256 hash and zero unsafe-inline in script-src', () => {
  const expectedToken = `script-src 'sha256-${scriptSha256Base64}'`;
  const hasExactHash = html.includes(expectedToken) && cspHardenedHtml.includes(`<meta http-equiv="Content-Security-Policy"`) && cspHardenedHtml.includes(expectedToken);
  const scriptSrcUnsafe = /script-src[^;]*unsafe-inline/i.test(html);
  return {
    pass: hasExactHash && !scriptSrcUnsafe,
    actual: `hasExactHash=${hasExactHash}, scriptSrcUnsafe=${scriptSrcUnsafe}`,
    expected: 'hasExactHash=true, scriptSrcUnsafe=false'
  };
});

// P2-02: Magic-byte logo verification rejects spoofed text/SVG/HTML files and accepts real PNG/JPEG/WEBP headers
runTest('P2-02', 'Phase 2 (Security / Magic Bytes)', 'verifyImageMagicBytes() accepts PNG/JPEG/WEBP binary headers and rejects spoofed <svg>/HTML bytes', () => {
  const { zf } = createSandbox();
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0]);
  const jpgBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  const spoofSvg = new Uint8Array(Buffer.from('<svg onload=alert(1)>', 'utf8'));
  return {
    pass: zf.verifyImageMagicBytes(pngBytes) === 'image/png' &&
          zf.verifyImageMagicBytes(jpgBytes) === 'image/jpeg' &&
          zf.verifyImageMagicBytes(webpBytes) === 'image/webp' &&
          zf.verifyImageMagicBytes(spoofSvg) === false,
    actual: `png=${zf.verifyImageMagicBytes(pngBytes)}, jpg=${zf.verifyImageMagicBytes(jpgBytes)}, webp=${zf.verifyImageMagicBytes(webpBytes)}, spoofSvg=${zf.verifyImageMagicBytes(spoofSvg)}`,
    expected: 'png=image/png, jpg=image/jpeg, webp=image/webp, spoofSvg=false'
  };
});

// P2-03: E.164 WhatsApp phone validation (8-15 digits)
runTest('P2-03', 'Phase 2 (WhatsApp E.164 Validation)', 'isValidE164Digits() accepts 8-15 digit international numbers and rejects short/malformed numbers', () => {
  const { zf } = createSandbox();
  const validIn = zf.isValidE164Digits('+91 98765 43210');
  const validAe = zf.isValidE164Digits('+971-50-123-4567');
  const invalidShort = zf.isValidE164Digits('12345');
  const invalidLong = zf.isValidE164Digits('12345678901234567890');
  return {
    pass: validIn === '919876543210' && validAe === '971501234567' && invalidShort === '' && invalidLong === '',
    actual: `validIn="${validIn}", validAe="${validAe}", short="${invalidShort}", long="${invalidLong}"`,
    expected: 'validIn="919876543210", validAe="971501234567", short="", long=""'
  };
});

// P2-04 (BASE-07 Fix): Collision-free makeNumber() + Document Types + Activity Log
runTest('P2-04', 'Phase 2 (Numbering / BASE-07 Fix)', 'makeNumber() automatically skips existing invoice numbers (INV-0001 -> INV-0002) and supports all 5 document types', () => {
  const { zf } = createSandbox();
  zf.S.invoices.push(zf.normInvoice({ number: 'INV-0001', client: { name: 'Existing' } }));
  zf.S.settings.defaults.prefix = 'INV-';
  zf.S.settings.defaults.next = 1;
  const nextNum = zf.makeNumber();
  const quoteInv = zf.normInvoice({ title: 'quote', lang: 'ar', items: [{ desc: 'Design', qty: '1', rate: '500' }] });
  const paperQuote = zf.renderPaper(quoteInv, {});
  return {
    pass: nextNum === 'INV-0002' && zf.DOC_TYPES.length === 5 && paperQuote.includes('عرض سعر'),
    actual: `makeNumber()="${nextNum}", docTypes=${zf.DOC_TYPES.length}, hasArabicQuoteTitle=${paperQuote.includes('عرض سعر')}`,
    expected: 'makeNumber()="INV-0002", docTypes=5, hasArabicQuoteTitle=true'
  };
});

// P3-01: Bilingual Print Headers (Native + English) & Arabic-Indic Numerals (٠-٩)
runTest('P3-01', 'Phase 3 (Bilingual Print & Arabic-Indic Numerals)', 'Enabling bilingualPrint and arabic_indic numerals renders "فاتورة / Invoice" and Arabic-Indic digits on Arabic/Urdu paper', () => {
  const { zf } = createSandbox();
  zf.S.settings.bilingualPrint = true;
  zf.S.settings.numerals = 'arabic_indic';
  const arInv = zf.normInvoice({ number: 'INV-2026', lang: 'ar', currency: 'AED', items: [{ desc: 'خدمة', qty: '2', rate: '150' }] });
  const paper = zf.renderPaper(arInv, {});
  const hasBilingual = paper.includes('فاتورة / Invoice') && paper.includes('الوصف / Description');
  const hasIndicDigits = paper.includes('٢٠٢٦');
  return {
    pass: hasBilingual && hasIndicDigits,
    actual: `hasBilingual=${hasBilingual}, hasIndicDigits=${hasIndicDigits}`,
    expected: 'hasBilingual=true, hasIndicDigits=true'
  };
});

// P3-02 (BASE-10 Fix): Keyboard Enter/Space on .inv-row[data-act="select-inv"] + Light/Dark Theme toggle
runTest('P3-02', 'Phase 3 (Keyboard A11y BASE-10 Fix & Theme)', 'Pressing Enter or Space on .inv-row selects the invoice, and applyTheme() toggles data-theme="light"', () => {
  const { zf, document, docEl } = createSandbox();
  const inv1 = zf.normInvoice({ id: 'inv_a1', number: 'INV-0001', client: { name: 'Alpha' } });
  const inv2 = zf.normInvoice({ id: 'inv_b2', number: 'INV-0002', client: { name: 'Beta' } });
  zf.S.invoices.push(inv1, inv2);
  zf.ui.selectedId = 'inv_a1';

  let prevented = false;
  document.dispatchKeydown({
    key: 'Enter',
     preventDefault() { prevented = true; },
    target: {
      tagName: 'DIV',
      closest(sel) { return sel === '.inv-row[data-act="select-inv"]' ? { dataset: { id: 'inv_b2' } } : null; }
    }
  });
  zf.S.settings.theme = 'light';
  zf.applyTheme();
  return {
    pass: prevented && zf.ui.selectedId === 'inv_b2' && docEl.getAttribute('data-theme') === 'light',
    actual: `selectedId="${zf.ui.selectedId}", theme="${docEl.getAttribute('data-theme')}"`,
    expected: 'selectedId="inv_b2", theme="light"'
  };
});

// P4-01: Accounts Receivable (AR) Ageing Breakdown & Built-In Self-Test Suite
runTest('P4-01', 'Phase 4 (AR Ageing & Built-in Self-Tests)', 'computeAgeing() buckets unpaid balances into Current, 1-30, 31-60, and 61-90+ days per currency, and runBuiltInSelfTests() passes 6/6', () => {
  const { zf } = createSandbox();
  const t = zf.todayISO();
  zf.S.invoices = [
    zf.normInvoice({ status: 'sent', issue: zf.addDays(t, -5), due: zf.addDays(t, 10), currency: 'USD', items: [{ desc: 'Current', qty: '1', rate: '100' }] }),
    zf.normInvoice({ status: 'sent', issue: zf.addDays(t, -30), due: zf.addDays(t, -15), currency: 'USD', items: [{ desc: '15d late', qty: '1', rate: '250' }] }),
    zf.normInvoice({ status: 'sent', issue: zf.addDays(t, -60), due: zf.addDays(t, -45), currency: 'INR', items: [{ desc: '45d late', qty: '1', rate: '5000' }] }),
    zf.normInvoice({ status: 'sent', issue: zf.addDays(t, -120), due: zf.addDays(t, -95), currency: 'AED', items: [{ desc: '95d late', qty: '1', rate: '800' }] })
  ];
  const age = zf.computeAgeing();
  const selfTests = zf.runBuiltInSelfTests();
  const allSelfPass = selfTests.every(x => x.pass);
  return {
    pass: age.current.USD === 10000 && age.d30.USD === 25000 && age.d60.INR === 500000 && age.d90.AED === 80000 && allSelfPass,
    actual: `age=${JSON.stringify(age)}, selfTests=${selfTests.filter(x => x.pass).length}/${selfTests.length}`,
    expected: 'current.USD=10000, d30.USD=25000, d60.INR=500000, d90.AED=80000, selfTests=6/6'
  };
});

console.log('\n--- PHASES 2, 3 & 4 TEST RESULTS ---');
let passed = 0;
results.forEach(r => {
  if (r.pass) passed++;
  console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.id} (${r.phase}): ${r.description}`);
  console.log(`   Actual:   ${r.actual}`);
  console.log(`   Expected: ${r.expected}`);
});
console.log(`\nSummary: ${passed}/${results.length} Phases 2-4 tests passed.`);
if (passed !== results.length) process.exit(1);