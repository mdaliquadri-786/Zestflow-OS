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
    compileSyncPayload, mergeSyncPayload
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

console.log('=== MODULE 4: ZERO-BACKEND CLOUD SYNC ADAPTER VERIFICATION ===');

runTest('MOD4-01', 'Sync Payload Compilation', 'compileSyncPayload exports complete state bundle with schemaVersion, settings, and invoices', () => {
  const { zf } = createSandbox();
  zf.S.invoices = [zf.normInvoice({ id: 'inv_sync_1', number: 'INV-001' })];
  const payload = zf.compileSyncPayload();
  const pass = payload.schemaVersion === zf.SCHEMA_VERSION && payload.invoices.length === 1 && typeof payload.settings === 'object';
  return { pass, actual: `version=${payload.schemaVersion}, count=${payload.invoices.length}`, expected: 'Complete bundle with schemaVersion and invoices' };
});

runTest('MOD4-02', 'Two-Way Merge (New Invoices)', 'mergeSyncPayload appends newly created remote invoices to local store', () => {
  const { zf } = createSandbox();
  zf.S.invoices = [zf.normInvoice({ id: 'local_1', number: 'INV-LOC-1', updated: 1000 })];
  const remotePayload = {
    invoices: [
      { id: 'remote_new', number: 'INV-REM-9', updated: 2000, client: { name: 'Cloud Client' }, items: [{ desc: 'Cloud API', qty: '1', rate: '500' }] }
    ]
  };
  const report = zf.mergeSyncPayload(remotePayload);
  const pass = report.added === 1 && zf.S.invoices.length === 2 && zf.S.invoices.some(x => x.id === 'remote_new');
  return { pass, actual: `added=${report.added}, total=${zf.S.invoices.length}`, expected: 'added=1, total=2' };
});

runTest('MOD4-03', 'Two-Way Merge (Timestamp Win)', 'mergeSyncPayload replaces local invoice when remote invoice has newer updated timestamp', () => {
  const { zf } = createSandbox();
  zf.S.invoices = [zf.normInvoice({ id: 'shared_1', number: 'INV-10', status: 'sent', updated: 1000 })];
  const remotePayload = {
    invoices: [
      { id: 'shared_1', number: 'INV-10', status: 'paid', updated: 5000, items: [{ desc: 'Item', qty: '1', rate: '100' }] }
    ]
  };
  const report = zf.mergeSyncPayload(remotePayload);
  const updatedInv = zf.S.invoices.find(x => x.id === 'shared_1');
  const pass = report.updated === 1 && updatedInv.status === 'paid' && updatedInv.updated === 5000;
  return { pass, actual: `updated=${report.updated}, newStatus=${updatedInv.status}`, expected: 'updated=1, newStatus=paid' };
});

runTest('MOD4-04', 'Stale Remote Ignore', 'mergeSyncPayload does not overwrite local changes when local timestamp is newer', () => {
  const { zf } = createSandbox();
  zf.S.invoices = [zf.normInvoice({ id: 'shared_2', number: 'INV-20', status: 'paid', updated: 9000 })];
  const remotePayload = {
    invoices: [
      { id: 'shared_2', number: 'INV-20', status: 'draft', updated: 3000, items: [] }
    ]
  };
  const report = zf.mergeSyncPayload(remotePayload);
  const currentInv = zf.S.invoices.find(x => x.id === 'shared_2');
  const pass = report.updated === 0 && currentInv.status === 'paid';
  return { pass, actual: `updated=${report.updated}, status=${currentInv.status}`, expected: 'updated=0, local changes kept' };
});

runTest('MOD4-05', 'Credential Preservation', 'mergeSyncPayload preserves local endpoint and apiKey during settings sync', () => {
  const { zf } = createSandbox();
  zf.S.settings.sync = { enabled: true, endpoint: 'https://local.supabase.co', apiKey: 'secret_local_key', lastSync: 0, autoSync: true };
  const remotePayload = {
    settings: { business: { name: 'Synced Corp' }, sync: { endpoint: 'https://override.attack.com', apiKey: 'hacked' } },
    invoices: []
  };
  zf.mergeSyncPayload(remotePayload);
  const pass = zf.S.settings.business.name === 'Synced Corp' && zf.S.settings.sync.endpoint === 'https://local.supabase.co' && zf.S.settings.sync.apiKey === 'secret_local_key';
  return { pass, actual: `endpoint=${zf.S.settings.sync.endpoint}`, expected: 'Local sync credentials preserved' };
});

runTest('MOD4-06', 'Settings Normalization', 'normSettings properly validates and normalizes sync configuration', () => {
  const { zf } = createSandbox();
  const s = zf.normSettings({
    sync: { enabled: true, endpoint: 'https://api.supabase.co/rest/v1', apiKey: 'token_123', autoSync: true }
  });
  const pass = s.sync.enabled === true && s.sync.endpoint === 'https://api.supabase.co/rest/v1' && s.sync.autoSync === true;
  return { pass, actual: `enabled=${s.sync.enabled}, autoSync=${s.sync.autoSync}`, expected: 'Normalized sync object' };
});

runTest('MOD4-07', 'UI Controls Integration', 'index.html contains Sync Now button and Cloud Sync settings card', () => {
  const pass = html.includes('Zero-backend hybrid cloud sync') && html.includes('data-act="sync-now"');
  return { pass, actual: `hasSyncUI=${pass}`, expected: 'Sync card and button present in index.html' };
});

runTest('MOD4-08', 'CSP Security Lockdown', 'CSP allows secure HTTPS endpoints (connect-src) while locking script-src with exact hash', () => {
  const expectedToken = `script-src 'sha256-${scriptSha256}'`;
  const scriptSrcUnsafe = /script-src[^;]*unsafe-inline/i.test(html);
  const hasConnectSrc = html.includes("connect-src 'self' https:;");
  const pass = html.includes(expectedToken) && !scriptSrcUnsafe && hasConnectSrc;
  return { pass, actual: `hasExactHash=${html.includes(expectedToken)}, hasConnectSrc=${hasConnectSrc}`, expected: 'Hash-locked script-src + secure HTTPS connect-src' };
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

console.log(`\nSummary: ${passed}/${results.length} Module 4 tests passed.`);
process.exit(passed === results.length ? 0 : 1);
