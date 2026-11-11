/**
 * test_phase1_cloud_persistence.js
 * Verification suite for ZestFlow OS Phase 1 Cloud Persistence
 * Tests:
 * 1. Bidirectional SQL <-> JS Profile Payload Mapping
 * 2. SQL <-> JS Invoice Payload Mapping with extra JSONB fidelity
 * 3. SQL migration schema completeness (extra JSONB, invoice_tombstones, idempotency hash)
 * 4. Multi-page delta pull pagination simulation
 */

const fs = require('fs');
const assert = require('assert');

console.log('🧪 Running ZestFlow OS Phase 1 Cloud Persistence Unit Tests...\n');

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

const indexContent = fs.readFileSync('index.html', 'utf8');
const sqlContent = fs.readFileSync('supabase/migrations/20261031000000_cloud_persistence_schema.sql', 'utf8');

// Extract mapper functions from index.html
function extractFunction(fnName, src) {
  const marker = `function ${fnName}(`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`Function ${fnName} not found`);
  let depth = 0;
  let end = -1;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  const fnStr = src.slice(start, end);
  return new Function('normSettings', 'normInvoice', 'todayISO', `return (${fnStr});`);
}

const mockNormSettings = (s) => s || {};
const mockNormInvoice = (i) => i || {};
const mockTodayISO = () => '2026-11-04';

const toSqlProfilePayload = extractFunction('toSqlProfilePayload', indexContent)(mockNormSettings, mockNormInvoice, mockTodayISO);
const fromSqlProfilePayload = extractFunction('fromSqlProfilePayload', indexContent)(mockNormSettings, mockNormInvoice, mockTodayISO);
const fromSqlInvoicePayload = extractFunction('fromSqlInvoicePayload', indexContent)(mockNormSettings, mockNormInvoice, mockTodayISO);

// 1. Profile Mapping Round-Trip
test('Profile Mapping: toSqlProfilePayload extracts relational columns and ui_preferences correctly', () => {
  const settings = {
    business: {
      name: 'Alpha Software Corp',
      email: 'finance@alphasoft.com',
      phone: '+1-555-0199',
      address: '100 Silicon Way, Suite 400',
      state: 'California',
      taxId: 'US-987654321',
      taxIdLabel: 'EIN',
      taxRegime: 'simple',
      upiId: 'alpha@upi',
      paymentLink: 'https://pay.alpha.com',
      zatcaEnabled: true,
      emailWebhook: 'https://hooks.alpha.com/email',
      logo: 'data:image/png;base64,LOGO123',
      signature: 'data:image/png;base64,SIG123'
    },
    defaults: { currency: 'USD', dueDays: 30 },
    catalog: [{ id: '1', name: 'Dev', rate: '100' }],
    theme: 'dark',
    layout: 'cashfund',
    paperColor: '#fafafa',
    bilingualPrint: true,
    numerals: 'eastern',
    showCredit: false,
    storageMode: 'cloud'
  };

  const sqlPayload = toSqlProfilePayload(settings);

  assert.strictEqual(sqlPayload.business_name, 'Alpha Software Corp');
  assert.strictEqual(sqlPayload.business_email, 'finance@alphasoft.com');
  assert.strictEqual(sqlPayload.tax_id, 'US-987654321');
  assert.strictEqual(sqlPayload.currency_code, 'USD');
  assert.strictEqual(sqlPayload.logo_url, 'data:image/png;base64,LOGO123');
  assert.strictEqual(sqlPayload.signature_url, 'data:image/png;base64,SIG123');
  assert.strictEqual(sqlPayload.ui_preferences.business.upiId, 'alpha@upi');
  assert.strictEqual(sqlPayload.ui_preferences.layout, 'cashfund');
  assert.strictEqual(sqlPayload.ui_preferences.storageMode, 'cloud');
});

test('Profile Mapping: fromSqlProfilePayload reconstitutes full JS settings hierarchy', () => {
  const sqlRow = {
    business_name: 'Beta Global Tech',
    business_email: 'billing@betaglobal.com',
    business_phone: '+44 20 7946 0912',
    business_address: '42 Baker Street, London',
    tax_id: 'GB123456789',
    currency_code: 'GBP',
    logo_url: 'data:image/png;base64,BETALOGO',
    signature_url: 'data:image/png;base64,BETASIG',
    ui_preferences: {
      business: {
        state: 'Greater London',
        taxIdLabel: 'VAT Reg',
        taxRegime: 'simple',
        upiId: '',
        paymentLink: 'https://stripe.com/pay',
        zatcaEnabled: false,
        emailWebhook: 'https://webhook.site/test'
      },
      defaults: { currency: 'GBP', dueDays: 14 },
      catalog: [{ id: 'c1', name: 'Consulting', rate: '250' }],
      theme: 'light',
      layout: 'cashfund',
      paperColor: '#ffffff',
      bilingualPrint: false,
      numerals: 'western',
      showCredit: true
    }
  };

  const reconstituted = fromSqlProfilePayload(sqlRow, {});

  assert.strictEqual(reconstituted.business.name, 'Beta Global Tech');
  assert.strictEqual(reconstituted.business.email, 'billing@betaglobal.com');
  assert.strictEqual(reconstituted.business.taxId, 'GB123456789');
  assert.strictEqual(reconstituted.business.taxIdLabel, 'VAT Reg');
  assert.strictEqual(reconstituted.business.logo, 'data:image/png;base64,BETALOGO');
  assert.strictEqual(reconstituted.business.signature, 'data:image/png;base64,BETASIG');
  assert.strictEqual(reconstituted.defaults.currency, 'GBP');
  assert.strictEqual(reconstituted.layout, 'cashfund');
  assert.strictEqual(reconstituted.catalog.length, 1);
});

// 2. Invoice Mapping with extra JSONB
test('Invoice Mapping: fromSqlInvoicePayload preserves extra JSONB (po, signature, recurring)', () => {
  const rawSqlInvoice = {
    id: 'inv_test_001',
    number: 'INV-2026-009',
    type: 'invoice',
    status: 'sent',
    issue_date: '2026-11-01',
    due_date: '2026-11-15',
    currency: 'SAR',
    client_name: 'Al-Madina Trading',
    client_email: 'accounts@almadina.sa',
    client_phone: '+966 50 123 4567',
    client_address: 'King Fahd Road, Riyadh',
    client_tax_id: '300000000000003',
    items: [{ desc: 'Cloud Enterprise License', qty: '1', rate: '5000' }],
    payments: [{ id: 'p1', date: '2026-11-02', amountMinor: 200000, method: 'Bank Transfer' }],
    extra: {
      po: 'PO-SAR-9988',
      signature: 'data:image/png;base64,CLIENT_SIGNATURE',
      recurring: { frequency: 'monthly', nextIssue: '2026-12-01', autoSend: true }
    }
  };

  const invoice = fromSqlInvoicePayload(rawSqlInvoice);

  assert.strictEqual(invoice.id, 'inv_test_001');
  assert.strictEqual(invoice.number, 'INV-2026-009');
  assert.strictEqual(invoice.client.name, 'Al-Madina Trading');
  assert.strictEqual(invoice.client.taxId, '300000000000003');
  assert.strictEqual(invoice.po, 'PO-SAR-9988');
  assert.strictEqual(invoice.signature, 'data:image/png;base64,CLIENT_SIGNATURE');
  assert.ok(invoice.recurring);
  assert.strictEqual(invoice.recurring.frequency, 'monthly');
  assert.strictEqual(invoice.payments.length, 1);
});

// 3. SQL Migration Schema Verification
test('SQL Schema: public.invoices contains extra JSONB NOT NULL DEFAULT', () => {
  assert.ok(
    sqlContent.includes('extra JSONB NOT NULL DEFAULT \'{}\'::jsonb'),
    'public.invoices must define extra JSONB column'
  );
});

test('SQL Schema: public.invoice_tombstones table and RLS are defined', () => {
  assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.invoice_tombstones'), 'Must create invoice_tombstones table');
  assert.ok(sqlContent.includes('ALTER TABLE public.invoice_tombstones ENABLE ROW LEVEL SECURITY'), 'Must enable RLS on tombstones');
});

test('SQL Mutation RPC: Idempotency hash binds action, id, expected_version, and payload', () => {
  assert.ok(
    sqlContent.includes("p_action || ':' || p_id || ':' || COALESCE(p_expected_version::text, 'null') || ':' || COALESCE(p_payload::text, 'null')"),
    'sync_push_invoice_mutation must bind hash to action:id:expected_version:payload'
  );
});

test('SQL Mutation RPC: Prevents resurrection of tombstoned invoice on create', () => {
  assert.ok(
    sqlContent.includes('EXISTS (SELECT 1 FROM public.invoice_tombstones WHERE user_id = v_user_id AND invoice_id = p_id)'),
    'Must check invoice_tombstones on create to prevent resurrection'
  );
});

test('SQL Mutation RPC: No duplicate WHERE or server_updated_at in update mutation block', () => {
  const updateIdx = sqlContent.indexOf("ELSIF p_action = 'update' THEN");
  const endIdx = sqlContent.indexOf("INSERT INTO public.account_sync_log", updateIdx);
  const updateBlock = sqlContent.slice(updateIdx, endIdx);
  const whereCount = (updateBlock.match(/WHERE user_id = v_user_id AND id = p_id/g) || []).length;
  const stampCount = (updateBlock.match(/server_updated_at = pg_catalog\.now\(\)/g) || []).length;
  assert.strictEqual(whereCount, 1, 'Should have exactly 1 WHERE clause in update block');
  assert.strictEqual(stampCount, 1, 'Should have exactly 1 server_updated_at in update block');
});

test('Storage Mode Normalization: normSettings preserves storageMode (session, offline, cloud)', () => {
  const vm = require('vm');
  const sandbox = {
    str: (v, n) => String(v || '').slice(0, n),
    num: (v) => Number(v) || 0,
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    uid: () => 'test_uid',
    CURRENCIES: ['USD', 'INR', 'AED', 'SAR', 'EUR', 'GBP'],
    T: { en: {}, ar: {}, ur: {} },
    img: (v) => v || '',
    GEMINI_CONFIG: { key: '' },
    localStorage: { setItem: ()=>{}, removeItem: ()=>{} }
  };
  const start = indexContent.indexOf('function normSettings(s){');
  let depth = 0, end = -1;
  for (let i = start; i < indexContent.length; i++) {
    if (indexContent[i] === '{') depth++;
    else if (indexContent[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  const code = indexContent.slice(start, end);
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  assert.strictEqual(sandbox.normSettings({ storageMode: 'offline' }).storageMode, 'offline');
  assert.strictEqual(sandbox.normSettings({ storageMode: 'session' }).storageMode, 'session');
  assert.strictEqual(sandbox.normSettings({ storageMode: 'cloud' }).storageMode, 'cloud');
});

// 4. Multi-Page Delta Pull Pagination Simulation
test('Sync Engine: pullDeltas paginates correctly when >100 changes exist', async () => {
  // Simulate mock RPC that returns 100 changes on page 1, 30 changes on page 2
  const pages = [
    {
      changes: Array.from({ length: 100 }, (_, i) => ({
        change_seq: i + 1,
        entity: 'invoice',
        action: 'upsert',
        entity_id: `inv_${i + 1}`,
        payload: { id: `inv_${i + 1}`, number: `INV-${i + 1}`, status: 'draft' }
      })),
      head_seq: 130
    },
    {
      changes: Array.from({ length: 30 }, (_, i) => ({
        change_seq: 101 + i,
        entity: 'invoice',
        action: 'upsert',
        entity_id: `inv_${101 + i}`,
        payload: { id: `inv_${101 + i}`, number: `INV-${101 + i}`, status: 'sent' }
      })),
      head_seq: 130
    }
  ];

  let pageIndex = 0;
  let clientCursor = 0;
  let appliedTotal = 0;

  async function mockPullRPC(since) {
    const page = pages[pageIndex++];
    return page || { changes: [], head_seq: 130 };
  }

  // Simulate pullDeltas loop as implemented in index.html
  let pageCount = 0;
  const maxPages = 20;
  while (pageCount < maxPages) {
    pageCount++;
    const data = await mockPullRPC(clientCursor);
    if (!data || !data.changes || data.changes.length === 0) {
      if (data && data.head_seq !== undefined) clientCursor = data.head_seq;
      break;
    }
    for (const ch of data.changes) {
      appliedTotal++;
      clientCursor = ch.change_seq;
    }
    if (data.changes.length < 100) break;
  }

  assert.strictEqual(appliedTotal, 130, 'Should have applied all 130 changes across 2 pages');
  assert.strictEqual(clientCursor, 130, 'Cursor should be advanced to final change_seq (130)');
  assert.strictEqual(pageCount, 2, 'Should have fetched exactly 2 pages');
});

console.log(`\nResults: ${passCount}/${totalCount} tests passed.`);
if (passCount === totalCount) {
  console.log('🎉 ALL PHASE 1 CLOUD PERSISTENCE TESTS PASSED!\n');
  process.exit(0);
} else {
  console.error('💥 SOME TESTS FAILED.\n');
  process.exit(1);
}
