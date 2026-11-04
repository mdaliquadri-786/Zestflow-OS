/**
 * test_index_cloud_sync_integration.js
 * Integration test suite for ZestFlow OS Cloud Sync, Storage Modes & Onboarding
 * Tests:
 * 1. Unified persistence config (getPersistenceConfig)
 * 2. Storage modes (session, cloud, offline) & persistence isolation
 * 3. Universal dialog clipping CSS
 * 4. Guided 2-step setup modal & coach-mark callout
 * 5. CSP Script Hash byte-for-byte lock
 */

const fs = require('fs');
const crypto = require('crypto');
const assert = require('assert');

console.log('🧪 Running ZestFlow OS Cloud Sync & Onboarding Integration Tests...\n');

let passCount = 0;
let totalCount = 0;

function test(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

const html = fs.readFileSync('index.html', 'utf8');

// 1. Unified persistence config
test('Persistence Config: getPersistenceConfig defaults to SUPABASE_CONFIG and respects zf_supabase_staging_override', () => {
  assert.ok(html.includes('function getPersistenceConfig()'), 'getPersistenceConfig function must exist');
  assert.ok(html.includes('zf_supabase_staging_override'), 'Must support zf_supabase_staging_override in localStorage');
  assert.ok(html.includes('SUPABASE_CONFIG.url'), 'Default must use active SUPABASE_CONFIG.url');
  assert.ok(html.includes('SUPABASE_CONFIG.anonKey'), 'Default must use active SUPABASE_CONFIG.anonKey');
});

// 2. Storage Modes & Persistence Isolation
test('Storage Modes: setStorageMode supports session, cloud, offline modes', () => {
  assert.ok(html.includes('function setStorageMode(mode)'), 'setStorageMode function must exist');
  assert.ok(html.includes("if (mode === 'session')"), 'Must handle session mode');
  assert.ok(html.includes("zf_session_vault"), 'Must save to zf_session_vault in sessionStorage for session mode');
  assert.ok(html.includes("localStorage.setItem(KEY, JSON.stringify(S))"), 'Must save to localStorage for offline/cloud modes');
});

test('Storage Modes: loadState and persist handle session mode without leaking to localStorage or cloud', () => {
  assert.ok(html.includes("sessionStorage.getItem('zf_session_vault')"), 'loadState must check zf_session_vault');
  assert.ok(html.includes("if(curMode === 'session')"), 'persist must isolate session mode');
  assert.ok(html.includes("if(curMode === 'offline')"), 'persist must isolate offline mode from cloud queue');
});

test('Honest Feedback: sync-now informs user honestly when session/offline mode is active', () => {
  assert.ok(html.includes("Storage mode is Temporary Session: cloud sync disabled"), 'sync-now must warn on session mode');
  assert.ok(html.includes("Storage mode is Full Offline Vault: cloud sync disabled"), 'sync-now must warn on offline mode');
});

// 3. Universal Dialog Clipping CSS
test('Universal Dialog CSS: dialog and dialog .dlg have responsive width constraints', () => {
  assert.ok(
    html.includes('dialog{max-width:calc(100vw - 24px);box-sizing:border-box}') ||
    html.includes('dialog{max-width:calc(100vw - 24px)'),
    'dialog must have max-width calc(100vw - 24px)'
  );
  assert.ok(
    html.includes('dialog .dlg{width:100%!important;max-width:100%!important;box-sizing:border-box!important}'),
    'dialog .dlg must have width 100%!important'
  );
});

// 4. Guided 2-Step Setup Modal & Coach-Mark Callout
test('Workspace Setup UI: Dialog #workspaceSetupDlg and Coach-Mark #settingsCoachMark exist in DOM', () => {
  assert.ok(html.includes('id="workspaceSetupDlg"'), '#workspaceSetupDlg dialog must exist');
  assert.ok(html.includes('id="settingsCoachMark"'), '#settingsCoachMark floating callout must exist');
  assert.ok(html.includes('function openWorkspaceSetupDlg'), 'openWorkspaceSetupDlg must exist');
  assert.ok(html.includes('function closeWorkspaceSetupDlg'), 'closeWorkspaceSetupDlg must exist');
  assert.ok(html.includes('function checkAndTriggerWorkspaceSetup'), 'checkAndTriggerWorkspaceSetup must exist');
});

test('Workspace Setup UI: Settings page contains 3-storage-mode selector and launch button', () => {
  assert.ok(html.includes('data-act="open-workspace-setup"'), 'Settings page must have button to launch guided setup');
  assert.ok(html.includes('data-act="select-storage-mode" data-mode="session"'), 'Settings page must have session storage switcher');
  assert.ok(html.includes('data-act="select-storage-mode" data-mode="cloud"'), 'Settings page must have cloud storage switcher');
  assert.ok(html.includes('data-act="select-storage-mode" data-mode="offline"'), 'Settings page must have offline storage switcher');
});

// 5. CSP Script Hash Lock
test('CSP Security: SHA-256 in <meta> tag matches exact byte-for-byte hash of <script>', () => {
  const scStart = html.indexOf('<script>');
  const scEnd = html.indexOf('</script>');
  assert.ok(scStart !== -1 && scEnd !== -1, 'Script tags must be found');
  const scriptContent = html.slice(scStart + 8, scEnd);
  const calculatedHash = 'sha256-' + crypto.createHash('sha256').update(scriptContent).digest('base64');
  
  const metaMatch = html.match(/script-src 'sha256-([^']+)'/);
  assert.ok(metaMatch, 'CSP script-src hash must be found in meta tag');
  const metaHash = 'sha256-' + metaMatch[1];

  assert.strictEqual(metaHash, calculatedHash, 'CSP meta hash must match script content hash exactly');
});

console.log(`\nResults: ${passCount}/${totalCount} tests passed.`);
if (passCount === totalCount) {
  console.log('🎉 ALL INTEGRATION TESTS PASSED!\n');
  process.exit(0);
} else {
  console.error('💥 SOME INTEGRATION TESTS FAILED.\n');
  process.exit(1);
}
