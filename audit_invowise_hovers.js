const fs = require('fs');
const http = require('http');
const path = require('path');
const pw = require('playwright-core');

const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(htmlContent);
});

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  console.log('Server running on port ' + port);

  const browser = await pw.chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  await page.addInitScript(() => {
    localStorage.setItem('zf_auth_session', JSON.stringify({
      access_token: 'mock_bearer_token',
      user: { email: 'ceo@enterprise.com', id: 'usr_ceo_001', user_metadata: { full_name: 'Chief Executive' } }
    }));
    localStorage.setItem('zf_auth_user', JSON.stringify({ email: 'ceo@enterprise.com', id: 'usr_ceo_001', name: 'Chief Executive' }));
    localStorage.setItem('zf_onboarded', 'true');
    localStorage.setItem('zf_session_active', 'true');
    localStorage.setItem('zestflow.v2', JSON.stringify({
      schemaVersion: 3,
      settings: {
        layout: 'invowise',
        theme: 'light',
        business: { name: 'Acme Enterprise', upiId: 'acme@upi' }
      },
      invoices: [
        {
          id: 'inv_001',
          number: 'INV-2026-001',
          status: 'sent',
          client: { name: 'Alpha Tech', email: 'alpha@example.com', phone: '+15551234567', taxId: 'GSTIN123' },
          items: [{ desc: 'Enterprise Invoicing', qty: '1', rate: '25000' }],
          currency: 'USD',
          issue: '2026-10-01',
          due: '2026-10-15' // Overdue
        },
        {
          id: 'inv_002',
          number: 'INV-2026-002',
          status: 'paid',
          client: { name: 'Beta Systems', email: 'beta@example.com', phone: '+15559876543' },
          items: [{ desc: 'Cloud Migration Architecture', qty: '1', rate: '45000' }],
          currency: 'USD',
          issue: '2026-11-01',
          due: '2026-11-10' // Paid
        },
        {
          id: 'inv_003',
          number: 'INV-2026-003',
          status: 'sent',
          client: { name: 'Gamma Global', email: 'gamma@example.com', phone: '+15551122334' },
          items: [{ desc: 'Security Audit & Compliance', qty: '1', rate: '18000' }],
          currency: 'USD',
          issue: '2026-11-05',
          due: '2026-11-25' // Due
        }
      ]
    }));
  });

  await page.goto('http://127.0.0.1:' + port + '/');
  await page.waitForTimeout(1000);

  // Check current layout and page
  const bodyClass = await page.evaluate(() => document.body.className);
  console.log('Body classes:', bodyClass);

  // List of key interactive elements on invowise dashboard to audit
  const selectors = [
    '.invo-brand',
    '.cmd-pill-btn',
    '.invo-search-wrap',
    '.invo-icon-btn',
    '.invo-user-avatar',
    '.invo-pill',
    '.invo-metric-card',
    '.invo-date-pill',
    'button[data-act="open-consultant-claim"]',
    '.invo-sq-btn',
    '.invo-create-btn',
    '.invo-arrow-btn',
    '.invo-cur-pills button',
    '.invo-bar-col',
    '.invo-bar.striped',
    '.invo-bar-track',
    '.invo-target-tag',
    '.invo-filter-pill',
    '.invo-mini-search',
    '.invo-tbl th[data-act="dash-sort"]',
    '.invo-tbl tbody tr',
    '.invo-tbl tbody tr strong[data-act="inspect-jump"]',
    '.invo-status-badge',
    '.invo-action-btn',
    '.invo-remind-item',
    '.invo-link-btn',
    '.invo-gen-tab',
    '.invo-textarea',
    '.invo-ai-btn',
    '.invo-cat-pill',
    '.invo-showcase-card',
    '.invo-tpl-item',
    '.invo-tpl-add',
    '.dash-row-cb',
    'input[data-act="dash-check-all"]',
    '.zf-footer-link',
    '.zf-footer-act-btn',
    '.zf-creator-box',
    '.zf-back-to-top'
  ];

  const results = [];

  for (const sel of selectors) {
    const count = await page.locator(sel).count();
    if (count === 0) {
      results.push({ selector: sel, count: 0, status: 'NOT_FOUND' });
      continue;
    }
    const loc = page.locator(sel).first();
    const isVisible = await loc.isVisible();
    if (!isVisible) {
      results.push({ selector: sel, count, status: 'HIDDEN' });
      continue;
    }

    const before = await loc.evaluate(el => {
      const s = window.getComputedStyle(el);
      return {
        cursor: s.cursor,
        transition: s.transition,
        transform: s.transform,
        boxShadow: s.boxShadow,
        backgroundColor: s.backgroundColor,
        color: s.color,
        borderColor: s.borderColor,
        opacity: s.opacity
      };
    });

    await loc.hover({ force: true });
    await page.waitForTimeout(100);

    const after = await loc.evaluate(el => {
      const s = window.getComputedStyle(el);
      return {
        cursor: s.cursor,
        transition: s.transition,
        transform: s.transform,
        boxShadow: s.boxShadow,
        backgroundColor: s.backgroundColor,
        color: s.color,
        borderColor: s.borderColor,
        opacity: s.opacity
      };
    });

    // Check if any visual style changed
    const hasVisualChange = (
      before.transform !== after.transform ||
      before.boxShadow !== after.boxShadow ||
      before.backgroundColor !== after.backgroundColor ||
      before.color !== after.color ||
      before.borderColor !== after.borderColor ||
      before.opacity !== after.opacity
    );

    // Check if transition is defined
    const hasTransition = before.transition && before.transition !== 'all 0s ease 0s' && !before.transition.startsWith('none');

    results.push({
      selector: sel,
      count,
      status: 'OK',
      cursor: before.cursor,
      hasVisualChange,
      hasTransition,
      diff: {
        transform: before.transform !== after.transform ? [before.transform, after.transform] : null,
        boxShadow: before.boxShadow !== after.boxShadow ? [before.boxShadow, after.boxShadow] : null,
        bgColor: before.backgroundColor !== after.backgroundColor ? [before.backgroundColor, after.backgroundColor] : null,
        color: before.color !== after.color ? [before.color, after.color] : null,
        borderColor: before.borderColor !== after.borderColor ? [before.borderColor, after.borderColor] : null,
      }
    });
  }

  const noChange = results.filter(r => !r.hasVisualChange);
  console.log('--- AUDIT RESULTS SUMMARY ---');
  console.log('Total audited elements:', results.length);
  console.log('Elements with visual hover feedback:', results.filter(r => r.hasVisualChange).length);
  console.log('Elements with NO visual hover feedback:', noChange.length);
  console.log(JSON.stringify(noChange, null, 2));

  await page.screenshot({ path: 'test_invowise_dashboard_populated.png', fullPage: true });
  console.log('Screenshot saved to test_invowise_dashboard_populated.png');

  await browser.close();
  server.close();
});
