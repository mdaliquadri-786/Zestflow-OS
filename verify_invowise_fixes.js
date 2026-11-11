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
  console.log('Testing server on port ' + port);

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
          due: '2026-10-15'
        },
        {
          id: 'inv_002',
          number: 'INV-2026-002',
          status: 'paid',
          client: { name: 'Beta Systems', email: 'beta@example.com', phone: '+15559876543' },
          items: [{ desc: 'Cloud Migration Architecture', qty: '1', rate: '45000' }],
          currency: 'EUR',
          issue: '2026-11-01',
          due: '2026-11-10'
        },
        {
          id: 'inv_003',
          number: 'INV-2026-003',
          status: 'sent',
          client: { name: 'Gamma Global', email: 'gamma@example.com', phone: '+15551122334' },
          items: [{ desc: 'Security Audit & Compliance', qty: '1', rate: '18000' }],
          currency: 'INR',
          issue: '2026-11-05',
          due: '2026-11-25'
        }
      ]
    }));
  });

  await page.goto('http://127.0.0.1:' + port + '/');
  await page.waitForTimeout(800);

  const tests = [];

  // TEST 1: Brand logo hover
  const brand = page.locator('.invo-brand').first();
  await brand.hover();
  await page.waitForTimeout(300);
  const brandCheck = await page.evaluate(() => {
    const ast = document.querySelector('.invo-brand-asterisk');
    const name = document.querySelector('.invo-brand-name');
    return {
      astTransform: window.getComputedStyle(ast).transform,
      nameColor: window.getComputedStyle(name).color
    };
  });
  tests.push({
    test: '1. Brand logo hover animates asterisk & turns coral',
    passed: brandCheck.astTransform.includes('matrix') && (brandCheck.nameColor.includes('255, 87, 51') || brandCheck.nameColor.includes('255, 122, 92')),
    detail: brandCheck
  });

  // TEST 2: Inactive nav pill hover
  const navPill = page.locator('.invo-pill:not(.active)').first();
  const navBefore = await navPill.evaluate(el => window.getComputedStyle(el).backgroundColor);
  await navPill.hover();
  await page.waitForTimeout(300);
  const navAfter = await navPill.evaluate(el => window.getComputedStyle(el).backgroundColor);
  tests.push({
    test: '2. Inactive nav pill hover changes background',
    passed: navBefore !== navAfter,
    detail: { before: navBefore, after: navAfter }
  });

  // TEST 3: Metric card hover uses coral ring (not blue)
  const metricCard = page.locator('.invo-metric-card').first();
  await metricCard.hover();
  await page.waitForTimeout(300);
  const metricCheck = await metricCard.evaluate(el => {
    const s = window.getComputedStyle(el);
    return {
      transform: s.transform,
      boxShadow: s.boxShadow
    };
  });
  const hasBlue = metricCheck.boxShadow.includes('2, 132, 199') || metricCheck.boxShadow.includes('0284c7');
  const hasCoral = metricCheck.boxShadow.includes('255, 87, 51');
  tests.push({
    test: '3. Metric card hover uses coral ring and NOT blue',
    passed: !hasBlue && hasCoral,
    detail: metricCheck
  });

  // TEST 4: Bar chart track & striped bar hover
  const bar = page.locator('.invo-bar.striped').first();
  await bar.hover();
  await page.waitForTimeout(300);
  const barCheck = await bar.evaluate(el => {
    const s = window.getComputedStyle(el);
    return {
      transform: s.transform,
      filter: s.filter,
      boxShadow: s.boxShadow
    };
  });
  tests.push({
    test: '4. Bar chart striped bar elevates, brightens and glows on hover',
    passed: barCheck.transform.includes('matrix') && barCheck.filter.includes('brightness'),
    detail: barCheck
  });

  // TEST 5: Table sort header hover
  const sortTh = page.locator('.invo-tbl th[data-act="dash-sort"]').first();
  const sortBefore = await sortTh.evaluate(el => window.getComputedStyle(el).color);
  await sortTh.hover();
  await page.waitForTimeout(300);
  const sortAfter = await sortTh.evaluate(el => window.getComputedStyle(el).color);
  tests.push({
    test: '5. Table sort header turns coral on hover',
    passed: sortAfter.includes('255, 87, 51') || sortAfter.includes('255, 122, 92'),
    detail: { before: sortBefore, after: sortAfter }
  });

  // TEST 6: Table invoice number jump link hover
  const jumpLink = page.locator('.invo-tbl strong[data-act="inspect-jump"]').first();
  await jumpLink.hover();
  await page.waitForTimeout(300);
  const jumpCheck = await jumpLink.evaluate(el => {
    const s = window.getComputedStyle(el);
    return {
      color: s.color,
      textDecoration: s.textDecorationLine
    };
  });
  tests.push({
    test: '6. Invoice number turns coral and underlines on hover',
    passed: (jumpCheck.color.includes('255, 87, 51') || jumpCheck.color.includes('255, 122, 92')) && jumpCheck.textDecoration === 'underline',
    detail: jumpCheck
  });

  // TEST 7: Status badge hover
  const badge = page.locator('.invo-status-badge').first();
  const badgeBefore = await badge.evaluate(el => window.getComputedStyle(el).transform);
  await badge.hover();
  await page.waitForTimeout(300);
  const badgeAfter = await badge.evaluate(el => window.getComputedStyle(el).transform);
  tests.push({
    test: '7. Status badge scales and elevates on hover',
    passed: badgeBefore !== badgeAfter && badgeAfter.includes('matrix'),
    detail: { before: badgeBefore, after: badgeAfter }
  });

  // TEST 8: Email reminder item hover
  const remind = page.locator('.invo-remind-item').first();
  await remind.hover();
  await page.waitForTimeout(300);
  const remindCheck = await remind.evaluate(el => {
    const s = window.getComputedStyle(el);
    return {
      transform: s.transform,
      borderColor: s.borderColor
    };
  });
  tests.push({
    test: '8. Email reminder item elevates and highlights border on hover',
    passed: remindCheck.transform.includes('matrix') && remindCheck.borderColor.includes('255, 87, 51'),
    detail: remindCheck
  });

  // TEST 9: Receivables ageing box hover
  const ageing = page.locator('.invo-ageing-box').first();
  await ageing.hover();
  await page.waitForTimeout(300);
  const ageingCheck = await ageing.evaluate(el => {
    const s = window.getComputedStyle(el);
    return {
      transform: s.transform,
      borderColor: s.borderColor
    };
  });
  tests.push({
    test: '9. Ageing box elevates and highlights on hover',
    passed: ageingCheck.transform.includes('matrix') && ageingCheck.borderColor.includes('255, 87, 51'),
    detail: ageingCheck
  });

  // TEST 10: Arrow button hover
  const arrow = page.locator('.invo-arrow-btn').first();
  await arrow.hover();
  await page.waitForTimeout(300);
  const arrowCheck = await arrow.evaluate(el => {
    const s = window.getComputedStyle(el);
    return {
      transform: s.transform,
      color: s.color,
      borderColor: s.borderColor
    };
  });
  tests.push({
    test: '10. Arrow button translates diagonally and turns coral on hover',
    passed: arrowCheck.transform.includes('matrix') && (arrowCheck.color.includes('255, 87, 51') || arrowCheck.color.includes('255, 122, 92')),
    detail: arrowCheck
  });

  // TEST 11: Apple cursor follower physics
  // Move to non-interactive header inside card
  const cardH3 = page.locator('.invo-card h3').first();
  await cardH3.hover();
  await page.waitForTimeout(300);
  const cursorOnText = await page.evaluate(() => document.body.classList.contains('cursor-hover'));

  // Move to actual button
  const newBtn = page.locator('.invo-create-btn').first();
  await newBtn.hover();
  await page.waitForTimeout(300);
  const cursorOnBtn = await page.evaluate(() => document.body.classList.contains('cursor-hover'));

  tests.push({
    test: '11. Apple cursor follower: inactive over card text, active over interactive button',
    passed: !cursorOnText && cursorOnBtn,
    detail: { cursorOnText, cursorOnBtn }
  });

  // TEST 12: Dark mode currency pills hover check
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await page.waitForTimeout(300);
  const curBtn = page.locator('.invo-cur-pills button').nth(1); // EUR button
  await curBtn.hover();
  await page.waitForTimeout(300);
  const darkCurCheck = await curBtn.evaluate(el => {
    const s = window.getComputedStyle(el);
    return {
      bgColor: s.backgroundColor,
      color: s.color
    };
  });
  const isBlindingWhite = darkCurCheck.bgColor.includes('248, 250, 252') || darkCurCheck.bgColor.includes('255, 255, 255');
  tests.push({
    test: '12. Dark mode currency pills hover does NOT turn blinding white',
    passed: !isBlindingWhite && (darkCurCheck.color.includes('255, 87, 51') || darkCurCheck.color.includes('255, 122, 92')),
    detail: darkCurCheck
  });

  console.log('=== VERIFICATION TEST RESULTS ===');
  let allPass = true;
  tests.forEach(t => {
    console.log((t.passed ? '✅ PASS' : '❌ FAIL') + ' — ' + t.test);
    if (!t.passed) {
      allPass = false;
      console.log('   Detail:', t.detail);
    }
  });

  console.log('\nAll tests passed:', allPass);
  console.log('Console errors:', consoleErrors);

  await page.screenshot({ path: 'test_invowise_verified.png', fullPage: true });
  console.log('Verified screenshot saved to test_invowise_verified.png');

  await browser.close();
  server.close();
});
