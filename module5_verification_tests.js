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
    generateShareableInvoiceHTML,
    compileSyncPayload, mergeSyncPayload,
    generateInvoiceEmail
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

console.log('=== MODULE 5: AUTOMATED EMAIL & COMMUNICATION CENTER VERIFICATION ===');

runTest('MOD5-01', 'New Invoice Email Template', 'generateInvoiceEmail generates professional dispatch subject, line item summary, and mailto URL', () => {
  const { zf } = createSandbox();
  const inv = zf.normInvoice({
    number: 'INV-2026-88',
    client: { name: 'Acme Corp', email: 'billing@acme.com' },
    items: [{ desc: 'UI/UX Redesign', qty: '1', rate: '3500' }]
  });
  const email = zf.generateInvoiceEmail(inv, 'invoice');
  const pass = email.to === 'billing@acme.com' &&
               email.subject.includes('Invoice INV-2026-88') &&
               email.body.includes('UI/UX Redesign') &&
               email.mailtoUrl.startsWith('mailto:billing%40acme.com');
  return { pass, actual: `to=${email.to}, hasSubject=${email.subject.length > 0}`, expected: 'Valid new invoice email with mailto URL' };
});

runTest('MOD5-02', 'Paid Invoice Receipt Template', 'generateInvoiceEmail produces payment confirmation receipt when invoice is paid', () => {
  const { zf } = createSandbox();
  const inv = zf.normInvoice({
    number: 'INV-SETTLED-1',
    status: 'paid',
    client: { name: 'John Doe', email: 'john@example.com' },
    items: [{ desc: 'Retainer', qty: '1', rate: '1000' }]
  });
  const email = zf.generateInvoiceEmail(inv); // auto-detects 'receipt'
  const pass = email.type === 'receipt' && email.subject.includes('Paid in Full') && email.body.includes('Thank you for your payment!');
  return { pass, actual: `type=${email.type}, subject=${email.subject}`, expected: 'type=receipt with Paid in Full subject' };
});

runTest('MOD5-03', 'Overdue Reminder Severity Escalation', 'generateInvoiceEmail escalates reminder tone based on days past due', () => {
  const { zf } = createSandbox();
  const past35Days = zf.addDays(zf.todayISO(), -35);
  const invFirm = zf.normInvoice({
    number: 'INV-OVERDUE-FIRM',
    issue: zf.addDays(past35Days, -14),
    due: past35Days,
    status: 'sent',
    items: [{ desc: 'Consulting', qty: '1', rate: '2000' }]
  });
  const emailFirm = zf.generateInvoiceEmail(invFirm);
  const pass = emailFirm.type === 'reminder' && emailFirm.body.includes('significantly past due');
  return { pass, actual: `isFirmNotice=${emailFirm.body.includes('significantly past due')}`, expected: 'Firm reminder tone for 30+ days overdue' };
});

runTest('MOD5-04', 'Payment Links in Email Body', 'Email body embeds online payment link and UPI ID when configured', () => {
  const { zf } = createSandbox();
  zf.S.settings = zf.normSettings({
    business: { paymentLink: 'https://pay.stripe.com/demo_inv', upiId: 'merchant@upi' }
  });
  const inv = zf.normInvoice({ number: 'INV-LINKS', items: [{ desc: 'Work', qty: '1', rate: '500' }] });
  const email = zf.generateInvoiceEmail(inv, 'invoice');
  const pass = email.body.includes('https://pay.stripe.com/demo_inv') && email.body.includes('merchant@upi');
  return { pass, actual: `hasStripe=${email.body.includes('https://pay.stripe.com')}, hasUpi=${email.body.includes('merchant@upi')}`, expected: 'Payment link and UPI ID embedded' };
});

runTest('MOD5-05', 'Settings Email Webhook Field', 'normSettings validates and stores emailWebhook configuration', () => {
  const { zf } = createSandbox();
  const s = zf.normSettings({
    business: { emailWebhook: 'https://api.resend.com/emails' }
  });
  const pass = s.business.emailWebhook === 'https://api.resend.com/emails';
  return { pass, actual: s.business.emailWebhook, expected: 'https://api.resend.com/emails' };
});

runTest('MOD5-06', 'Remind Dialog Integration', 'remindDlg contains remindDlgMail action button', () => {
  const pass = html.includes('id="remindDlgMail"') && html.includes('Email Client');
  return { pass, actual: `hasMailBtnInDlg=${pass}`, expected: 'Email Client button in remind dialog' };
});

runTest('MOD5-07', 'Inspector Email Action', 'Invoice Inspector template contains data-act="email-invoice"', () => {
  const pass = html.includes('data-act="email-invoice"');
  return { pass, actual: `hasEmailActInInspector=${pass}`, expected: 'Email Client button in inspector' };
});

runTest('MOD5-08', 'CSP Security Lockdown', 'CSP meta tag in index.html matches exact script SHA-256 hash with zero unsafe-inline in script-src', () => {
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

console.log(`\nSummary: ${passed}/${results.length} Module 5 tests passed.`);
process.exit(passed === results.length ? 0 : 1);
