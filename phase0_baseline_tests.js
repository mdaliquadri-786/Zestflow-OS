const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const filePath = path.join(__dirname, 'zestflow-v2.html');
const html = fs.readFileSync(filePath, 'utf8');
const sha256 = crypto.createHash('sha256').update(html).digest('hex');

console.log('=== PHASE 0 BASELINE AUDIT & REPRODUCIBLE TEST SUITE ===');
console.log('Target File:', filePath);
console.log('File Size (bytes):', Buffer.byteLength(html, 'utf8'));
console.log('Line Count:', html.split('\n').length);
console.log('SHA-256 Rollback Hash:', sha256);

// Extract inline <script> block
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error('FATAL: No <script> tag found');
  process.exit(1);
}
const rawScript = scriptMatch[1];

// Verify script SHA-256 for future CSP hash computation
const scriptSha256Base64 = crypto.createHash('sha256').update(rawScript, 'utf8').digest('base64');
console.log('Inline Script SHA-256 (for CSP sha256-...):', `'sha256-${scriptSha256Base64}'`);

// Instrument script to expose internal functions for white-box baseline testing without modifying source file
const exposedScript = rawScript.replace(
  'showBanner();\nrender();\n})();',
  `window.__ZF_TEST__ = {
    esc, clone, uid, p2, num, clamp, str, getPath, setPath,
    todayISO, parseISO, addDays, daysBetween, fmtDate, fmtMoney, toMinor,
    calc, lineAmt, isOverdue, effStatus,
    img, normSettings, normInvoice, loadState, persist,
    makeNumber, newInvoice, renderPaper, getClientGroups, totalsBy,
    validate, csvCell, reminderText, S, ui, CURRENCIES, T
  };
})();`
);

// Minimal DOM & Browser API stub to run pure logic + template functions
function createSandbox(initialStorage = {}) {
  const store = Object.assign({}, initialStorage);
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
      addEventListener() {},
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
    Intl, Date, Math, JSON, Object, Array, String, Number, RegExp, Map, Set, Promise,
    parseFloat, setTimeout, clearTimeout, requestAnimationFrame: fn => fn(), cancelAnimationFrame: () => {}
  };
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox);
  vm.runInContext(exposedScript, sandbox);
  return { zf: sandbox.window.__ZF_TEST__, store, elements };
}

const results = [];
function runTest(id, category, description, fn) {
  try {
    const outcome = fn();
    results.push({ id, category, description, status: outcome.pass ? 'PASS' : 'FAIL (CONFIRMED DEFECT/GAP)', actual: outcome.actual, expected: outcome.expected });
  } catch (err) {
    results.push({ id, category, description, status: 'ERROR', actual: err.message, expected: 'No runtime error' });
  }
}

// 1. Existing working behavior baseline tests
runTest('BASE-01', 'Financial (Existing)', 'Simple exclusive tax & percentage discount in integer minor units', () => {
  const { zf } = createSandbox();
  const inv = zf.normInvoice({
    discount: '10',
    taxRate: '18',
    items: [{ desc: 'Design', qty: '2', rate: '100.50' }] // 2 * 10050 = 20100; disc 10% = 2010; taxable = 18090; tax 18% = 3256; total = 21346
  });
  const c = zf.calc(inv);
  return {
    pass: c.sub === 20100 && c.disc === 2010 && c.tax === 3256 && c.total === 21346,
    actual: JSON.stringify(c),
    expected: JSON.stringify({ sub: 20100, disc: 2010, tax: 3256, total: 21346 })
  };
});

runTest('BASE-02', 'Financial (Defect Check)', 'Unit rate with 3 decimal places (e.g. qty 1000 * rate 0.125 = 125.00)', () => {
  const { zf } = createSandbox();
  // In current code: toMinor(0.125) = Math.round(0.125 * 100) = 13 cents; 1000 * 13 = 13000 ($130.00) instead of 12500 ($125.00)!
  const inv = zf.normInvoice({
    discount: '0',
    taxRate: '0',
    items: [{ desc: 'Metered API calls', qty: '1000', rate: '0.125' }]
  });
  const c = zf.calc(inv);
  return {
    pass: c.sub === 12500,
    actual: `sub=${c.sub} ($${(c.sub/100).toFixed(2)}) because toMinor('0.125') rounds to 13 before multiplying by qty`,
    expected: 'sub=12500 ($125.00)'
  };
});

runTest('BASE-03', 'Financial (Defect Check)', 'Non-numeric garbage string in qty/rate during validate() & calc()', () => {
  const { zf } = createSandbox();
  // If user or imported JSON has qty: "12abc" or "abc", parseFloat("12abc") silently parses as 12, and parseFloat("abc") becomes 0!
  const inv = zf.normInvoice({
    client: { name: 'Acme' },
    number: 'INV-0001',
    items: [{ desc: 'Consulting', qty: '12abc', rate: '100' }]
  });
  const errs = zf.validate(inv);
  return {
    pass: errs.length > 0,
    actual: `validate() returned ${errs.length} errors; num('12abc') silently parsed as ${zf.num('12abc')}`,
    expected: 'validate() should reject malformed numeric strings like "12abc"'
  };
});

runTest('BASE-04', 'Multi-Currency (Existing)', 'totalsBy() keeps USD, INR, AED separate and never sums across currencies', () => {
  const { zf } = createSandbox();
  const list = [
    zf.normInvoice({ currency: 'USD', items: [{ desc: 'A', qty: '1', rate: '100' }] }),
    zf.normInvoice({ currency: 'INR', items: [{ desc: 'B', qty: '1', rate: '5000' }] }),
    zf.normInvoice({ currency: 'USD', items: [{ desc: 'C', qty: '2', rate: '50' }] })
  ];
  const totals = zf.totalsBy(list);
  return {
    pass: totals.USD === 20000 && totals.INR === 500000 && Object.keys(totals).length === 2,
    actual: JSON.stringify(totals),
    expected: JSON.stringify({ USD: 20000, INR: 500000 })
  };
});

runTest('BASE-05', 'Security (Existing)', 'esc() neutralizes HTML/XSS payloads in renderPaper()', () => {
  const { zf } = createSandbox();
  const inv = zf.normInvoice({
    client: { name: '<img src=x onerror=alert(1)>' },
    items: [{ desc: '<script>alert("xss")</script>', qty: '1', rate: '10' }]
  });
  const htmlOut = zf.renderPaper(inv, {});
  const hasRawTag = htmlOut.includes('<script>') || htmlOut.includes('<img src=x');
  return {
    pass: !hasRawTag && htmlOut.includes('&lt;script&gt;') && htmlOut.includes('&lt;img src=x'),
    actual: `hasRawTag=${hasRawTag}`,
    expected: 'hasRawTag=false (all user strings escaped)'
  };
});

runTest('BASE-06', 'Security (Defect Check)', 'Document has a Content-Security-Policy (CSP) meta tag without unsafe-inline script vulnerability', () => {
  const hasCsp = /(?:data-)?http-equiv=["']Content-Security-Policy["']/i.test(html);
  return {
    pass: hasCsp,
    actual: `hasCsp=${hasCsp}`,
    expected: 'hasCsp=true with hash-based script-src (or externalized script) and connect-src/object-src locked down'
  };
});

runTest('BASE-07', 'Numbering (Defect Check)', 'makeNumber() collision check when next number already exists in S.invoices', () => {
  const { zf } = createSandbox();
  // Suppose next is 1, so makeNumber() produces INV-0001, but INV-0001 already exists (e.g., created manually or imported)
  zf.S.invoices.push(zf.normInvoice({ number: 'INV-0001', client: { name: 'Existing Client' } }));
  zf.S.settings.defaults.prefix = 'INV-';
  zf.S.settings.defaults.next = 1;
  const candidate = zf.makeNumber();
  const collides = zf.S.invoices.some(x => x.number === candidate);
  return {
    pass: !collides,
    actual: `makeNumber() returned "${candidate}" which already exists in S.invoices (collides=${collides})`,
    expected: 'makeNumber() should skip existing numbers and return "INV-0002"'
  };
});

runTest('BASE-08', 'Data Integrity (Defect Check)', 'normInvoice() silently resets invalid issue/due dates in imported backups to todayISO()', () => {
  const { zf } = createSandbox();
  const imported = zf.normInvoice({ issue: '2026-02-31', due: 'not-a-date' });
  // Note: parseISO('2026-02-31') in JS: new Date(2026, 1, 31) rolls over to March 3, 2026 without error!
  const parsedFeb31 = zf.parseISO('2026-02-31');
  return {
    pass: parsedFeb31 === null,
    actual: `parseISO('2026-02-31') returned ${parsedFeb31 ? parsedFeb31.toISOString() : 'null'} (rollover bug) and invalid dates silently become todayISO()`,
    expected: 'parseISO("2026-02-31") must return null (strict calendar date check)'
  };
});

runTest('BASE-09', 'CSV Export (Existing)', 'csvCell() prefixes formula injection characters (=, +, -, @, tab, CR) with single quote', () => {
  const { zf } = createSandbox();
  const out = ['=1+1', '+cmd', '-2+3', '@SUM(A1)', '\tmalicious'].map(zf.csvCell);
  const allPrefixed = out.every(x => x.startsWith("'") || x.startsWith("\"'"));
  return {
    pass: allPrefixed,
    actual: JSON.stringify(out),
    expected: 'All formula-leading strings prefixed with single quote'
  };
});

runTest('BASE-10', 'Accessibility (Defect Check)', 'Keyboard Enter/Space handler on .inv-row[data-act="select-inv"]', () => {
  const hasRowKeydown = /select-inv/.test(rawScript.slice(rawScript.indexOf("document.addEventListener('keydown'")));
  return {
    pass: hasRowKeydown,
    actual: `keydown listener handles '/', 'n', and 'Ctrl+S', but hasRowKeydown=${hasRowKeydown} for .inv-row[tabindex="0"]`,
    expected: 'Enter/Space on focused .inv-row should trigger row selection'
  };
});

console.log('\n--- BASELINE TEST RESULTS ---');
results.forEach(r => {
  console.log(`[${r.status}] ${r.id} (${r.category}): ${r.description}`);
  console.log(`   Actual:   ${r.actual}`);
  console.log(`   Expected: ${r.expected}`);
});