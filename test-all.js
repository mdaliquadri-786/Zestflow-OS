const { execSync } = require('child_process');

console.log('🚀 Running Complete ZestFlow OS Master Verification Suite...\n');

const testSuites = [
  { name: 'Module 1: Dynamic UPI & ZATCA QR', file: 'module1_verification_tests.js', expected: 8 },
  { name: 'Module 2: Retainers & Recurring Invoices', file: 'module2_verification_tests.js', expected: 8 },
  { name: 'Module 3: Standalone Client Portal', file: 'module3_verification_tests.js', expected: 8 },
  { name: 'Module 4: Zero-Backend Cloud Sync', file: 'module4_verification_tests.js', expected: 8 },
  { name: 'Module 5: Automated Email Center', file: 'module5_verification_tests.js', expected: 8 },
  { name: 'E2E UI & Interactive Button Suite', file: 'e2e_ui_premium_verification.js', expected: 11 },
  { name: '7-Archetype & Commercial Document Suite', file: 'test_templates_and_commercial_docs_suite.js', expected: 24 },
  { name: 'Cloud Sync & Onboarding Integration', file: 'test_index_cloud_sync_integration.js', expected: 9 },
  { name: 'Industrial Typography Suite', file: 'test_typography_industrial_system.js', expected: 5 },
  { name: 'Phase 1 Cloud Persistence Suite', file: 'test_phase1_cloud_persistence.js', expected: 10 },
  { name: 'Master Fixes & Financial Audit Suite', file: 'scratch/test_master_fixes_audit.js', expected: 10 }
];

let totalPassed = 0;
let totalExpected = 0;
let hasFailure = false;

testSuites.forEach((suite, idx) => {
  totalExpected += suite.expected;
  try {
    const out = execSync(`node ${suite.file}`, { encoding: 'utf8' });
    const matches = out.match(/\[PASS\]/g);
    const passCount = matches ? matches.length : 0;
    totalPassed += passCount;
    if (passCount === suite.expected) {
      console.log(`✅ [${idx + 1}/${testSuites.length}] ${suite.name} — ${passCount}/${suite.expected} PASS`);
    } else {
      hasFailure = true;
      console.log(`⚠️ [${idx + 1}/${testSuites.length}] ${suite.name} — ${passCount}/${suite.expected} PASS (Mismatch!)`);
    }
  } catch (err) {
    hasFailure = true;
    console.error(`❌ [${idx + 1}/${testSuites.length}] ${suite.name} FAILED:`, err.message);
  }
});

console.log(`\n🏆 MASTER AUDIT RESULT: ${totalPassed}/${totalExpected} TESTS PASSED (${hasFailure ? 'FAILURES DETECTED' : '100% OK'})`);
if (hasFailure) {
  process.exit(1);
} else {
  console.log('⚡ All buttons, financial engines, CSP security, and UI transitions verified.');
}
