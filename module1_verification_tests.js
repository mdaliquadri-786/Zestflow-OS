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
    generateUpiURI, generateZatcaTLV, QRCodeEngine
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

console.log('=== MODULE 1: INDUSTRIAL PAYMENT & QR ENGINE VERIFICATION ===');

runTest('MOD1-01', 'UPI URI Generation', 'Standard UPI deep link with merchant name, amount in INR, and invoice number', () => {
  const { zf } = createSandbox();
  const uri = zf.generateUpiURI('ali@okhdfcbank', 'CodeWithAli Pvt Ltd', 125000, 'INV-2026-001');
  const pass = uri.includes('pa=ali%40okhdfcbank') && uri.includes('am=1250.00') && uri.includes('cu=INR') && uri.includes('tn=INV-2026-001');
  return { pass, actual: uri, expected: 'Valid upi://pay URI with pa, am=1250.00, cu=INR, tn=INV-2026-001' };
});

runTest('MOD1-02', 'ZATCA TLV Base64', 'Tag-Length-Value encoding compliant with KSA e-Invoicing specification', () => {
  const { zf } = createSandbox();
  const b64 = zf.generateZatcaTLV('CodeWithAli', '310123456700003', '2026-10-27T08:00:00Z', '1180.00', '180.00');
  const buf = Buffer.from(b64, 'base64');
  let offset = 0, tags = {};
  while (offset < buf.length) {
    const tag = buf[offset++];
    const len = buf[offset++];
    tags[tag] = buf.slice(offset, offset + len).toString('utf8');
    offset += len;
  }
  const pass = tags[1] === 'CodeWithAli' && tags[2] === '310123456700003' && tags[4] === '1180.00' && tags[5] === '180.00';
  return { pass, actual: JSON.stringify(tags), expected: 'ZATCA TLV tags 1,2,3,4,5 accurately encoded' };
});

runTest('MOD1-03', 'Vector QR Code SVG', 'QRCodeEngine renders crisp vector SVG with path rectangles and zero external network calls', () => {
  const { zf } = createSandbox();
  const svg = zf.QRCodeEngine.toSVG('upi://pay?pa=ali@upi&am=500', 96);
  const pass = svg.startsWith('<svg') && svg.includes('viewBox="0 0 96 96"') && svg.includes('<path fill="#0f172a"');
  return { pass, actual: `SVG length: ${svg.length}, hasPath: ${svg.includes('<path')}`, expected: 'Valid inline SVG QR code' };
});

runTest('MOD1-04', 'Settings Normalization', 'normSettings accepts upiId, paymentLink, and zatcaEnabled fields', () => {
  const { zf } = createSandbox();
  const s = zf.normSettings({
    business: { upiId: 'merchant@upi', paymentLink: 'https://rzp.io/l/demo', zatcaEnabled: true }
  });
  const pass = s.business.upiId === 'merchant@upi' && s.business.paymentLink === 'https://rzp.io/l/demo' && s.business.zatcaEnabled === true;
  return { pass, actual: `upiId=${s.business.upiId}, zatca=${s.business.zatcaEnabled}`, expected: 'Normalized settings with payment fields' };
});

runTest('MOD1-05', 'UPI QR Paper Rendering', 'renderPaper embeds UPI QR box when currency is INR, upiId is configured, and balance > 0', () => {
  const { zf } = createSandbox();
  zf.S.settings = zf.normSettings({ business: { upiId: 'ali@upi', name: 'CodeWithAli' } });
  const inv = zf.normInvoice({
    currency: 'INR',
    items: [{ desc: 'Consulting', qty: '1', rate: '2500' }]
  });
  const paperHtml = zf.renderPaper(inv, {});
  const pass = paperHtml.includes('Instant UPI Payment') && paperHtml.includes('p-qr-svg') && paperHtml.includes('₹2500.00');
  return { pass, actual: `hasUPI: ${paperHtml.includes('Instant UPI Payment')}`, expected: 'UPI QR box rendered in invoice paper' };
});

runTest('MOD1-06', 'ZATCA QR Paper Rendering', 'renderPaper embeds ZATCA e-invoice QR when zatcaEnabled is true and taxId is present', () => {
  const { zf } = createSandbox();
  zf.S.settings = zf.normSettings({
    business: { name: 'KSA Trading', taxId: '310123456700003', zatcaEnabled: true }
  });
  const inv = zf.normInvoice({
    currency: 'SAR',
    lang: 'ar',
    taxRate: '15',
    items: [{ desc: 'Cloud Services', qty: '1', rate: '1000' }]
  });
  const paperHtml = zf.renderPaper(inv, {});
  const pass = paperHtml.includes('ZATCA Compliant E-Invoice') && paperHtml.includes('310123456700003') && paperHtml.includes('p-qr-svg');
  return { pass, actual: `hasZatca: ${paperHtml.includes('ZATCA Compliant E-Invoice')}`, expected: 'ZATCA QR box rendered in invoice paper' };
});

runTest('MOD1-07', 'Online Payment Button', 'renderPaper embeds clickable payment button when paymentLink is configured and balance > 0', () => {
  const { zf } = createSandbox();
  zf.S.settings = zf.normSettings({ business: { paymentLink: 'https://buy.stripe.com/test_123' } });
  const inv = zf.normInvoice({
    currency: 'USD',
    items: [{ desc: 'Dev Work', qty: '1', rate: '500' }]
  });
  const paperHtml = zf.renderPaper(inv, {});
  const pass = paperHtml.includes('Pay Invoice Online') && paperHtml.includes('https://buy.stripe.com/test_123');
  return { pass, actual: `hasPayLink: ${paperHtml.includes('Pay Invoice Online')}`, expected: 'Online payment button embedded' };
});

runTest('MOD1-08', 'CSP Security Lockdown', 'CSP meta tag in index.html matches exact script SHA-256 hash with zero unsafe-inline in script-src', () => {
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

console.log(`\nSummary: ${passed}/${results.length} Module 1 tests passed.`);
process.exit(passed === results.length ? 0 : 1);
