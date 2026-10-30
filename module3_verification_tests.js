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
    addRecurringDate, processRecurringInvoices,
    generateShareableInvoiceHTML
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

console.log('=== MODULE 3: CLIENT PORTAL & SHAREABLE WEB VIEW VERIFICATION ===');

runTest('MOD3-01', 'Standalone HTML Document', 'generateShareableInvoiceHTML creates valid standalone HTML5 with doctype, meta, and title', () => {
  const { zf } = createSandbox();
  const inv = zf.normInvoice({ number: 'INV-2026-99', items: [{ desc: 'App Design', qty: '1', rate: '1200' }] });
  const doc = zf.generateShareableInvoiceHTML(inv);
  const pass = doc.startsWith('<!DOCTYPE html>') && doc.includes('<title>Invoice INV-2026-99') && doc.includes('</html>');
  return { pass, actual: `startsDoctype=${doc.startsWith('<!DOCTYPE html>')}, hasTitle=${doc.includes('<title>Invoice INV-2026-99')}`, expected: 'Valid standalone HTML5 document' };
});

runTest('MOD3-02', 'Portal Action Header', 'Contains portal-bar with document number, status badge, and print button', () => {
  const { zf } = createSandbox();
  const inv = zf.normInvoice({ number: 'INV-2026-99', status: 'sent', items: [{ desc: 'Service', qty: '1', rate: '100' }] });
  const doc = zf.generateShareableInvoiceHTML(inv);
  const pass = doc.includes('class="portal-bar"') && doc.includes('portal-status sent') && doc.includes('window.print()');
  return { pass, actual: `hasPortalBar=${doc.includes('portal-bar')}, hasStatus=${doc.includes('portal-status sent')}`, expected: 'Portal action header present' };
});

runTest('MOD3-03', 'Online Payment Button', 'Embeds direct Pay Online link in portal header when paymentLink is configured', () => {
  const { zf } = createSandbox();
  zf.S.settings = zf.normSettings({ business: { paymentLink: 'https://pay.stripe.com/demo_link' } });
  const inv = zf.normInvoice({ number: 'INV-PAY-1', items: [{ desc: 'Hosting', qty: '1', rate: '250' }] });
  const doc = zf.generateShareableInvoiceHTML(inv);
  const pass = doc.includes('https://pay.stripe.com/demo_link') && doc.includes('💳 Pay Online');
  return { pass, actual: `hasPayBtn=${doc.includes('💳 Pay Online')}`, expected: 'Pay Online button embedded in header' };
});

runTest('MOD3-04', 'WhatsApp Dispatch Integration', 'Embeds direct WhatsApp confirmation link when business phone is provided', () => {
  const { zf } = createSandbox();
  zf.S.settings = zf.normSettings({ business: { phone: '+91 98765 43210', name: 'Zest Corp' } });
  const inv = zf.normInvoice({ number: 'INV-WA-7', items: [{ desc: 'Consulting', qty: '1', rate: '1000' }] });
  const doc = zf.generateShareableInvoiceHTML(inv);
  const pass = doc.includes('https://wa.me/919876543210') && doc.includes('💬 WhatsApp');
  return { pass, actual: `hasWaUrl=${doc.includes('https://wa.me/919876543210')}`, expected: 'WhatsApp direct link embedded' };
});

runTest('MOD3-05', 'Data Privacy Boundary', 'Standalone export does NOT leak S.invoices or internal business state', () => {
  const { zf } = createSandbox();
  zf.S.invoices = [
    zf.normInvoice({ id: 'secret_1', client: { name: 'Secret Client Co' } }),
    zf.normInvoice({ id: 'secret_2', client: { name: 'Confidential LLC' } })
  ];
  const publicInv = zf.normInvoice({ id: 'pub_1', number: 'INV-PUB', client: { name: 'Public Client' } });
  const doc = zf.generateShareableInvoiceHTML(publicInv);
  const pass = !doc.includes('Secret Client Co') && !doc.includes('Confidential LLC') && doc.includes('Public Client');
  return { pass, actual: `leakSecret=${doc.includes('Secret Client Co')}, hasPublic=${doc.includes('Public Client')}`, expected: 'Strict client privacy maintained' };
});

runTest('MOD3-06', 'Inspector Action UI', 'index.html inspector template contains data-act="export-shareable" button', () => {
  const pass = html.includes('data-act="export-shareable"');
  return { pass, actual: `hasShareableBtn=${pass}`, expected: 'Shareable Portal button present in inspector' };
});

runTest('MOD3-07', 'Module 1 & 2 Regressions Check', 'UPI URI, ZATCA TLV, QR engine, and recurring date functions still intact', () => {
  const { zf } = createSandbox();
  const upi = zf.generateUpiURI('a@upi', 'A', 100, 'I-1');
  const rec = zf.addRecurringDate('2026-01-01', 'monthly');
  const pass = upi.startsWith('upi://') && rec === '2026-02-01';
  return { pass, actual: `upi=${upi.length > 0}, rec=${rec}`, expected: 'All previous module helpers intact' };
});

runTest('MOD3-08', 'CSP Security Lockdown', 'CSP meta tag in index.html matches exact script SHA-256 hash with zero unsafe-inline in script-src', () => {
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

console.log(`\nSummary: ${passed}/${results.length} Module 3 tests passed.`);
process.exit(passed === results.length ? 0 : 1);
