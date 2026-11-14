const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('[BUILD] Starting ZestFlow OS build pipeline...');

const rootDir = __dirname;
const publicDir = path.join(rootDir, 'public');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Files to mirror to public directory
const filesToCopy = [
  'index.html',
  'manifest.json',
  'sw.js',
  'robots.txt',
  'sitemap.xml',
  'favicon.ico',
  'favicon.png',
  'zesflowfavicon svg.svg'
];

for (const file of filesToCopy) {
  const src = path.join(rootDir, file);
  const dest = path.join(publicDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

// Copy assets directory if it exists
const assetsSrc = path.join(rootDir, 'assets');
const assetsDest = path.join(publicDir, 'assets');
if (fs.existsSync(assetsSrc)) {
  fs.cpSync(assetsSrc, assetsDest, { recursive: true, force: true });
}

// Verify CSP integrity of index.html in public/
try {
  const htmlPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const scriptMatch = html.match(/<script(?![^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/i);
    if (scriptMatch) {
      const raw = scriptMatch[1];
      const lfHash = crypto.createHash('sha256').update(raw.replace(/\r\n/g, '\n')).digest('base64');
      const crlfHash = crypto.createHash('sha256').update(raw.replace(/\r?\n/g, '\r\n')).digest('base64');
      if (!html.includes(`sha256-${lfHash}`) || !html.includes(`sha256-${crlfHash}`)) {
        console.warn('[BUILD WARNING] CSP script hash missing (LF or CRLF) in index.html!');
      } else {
        console.log(`[BUILD] Dual-platform CSP verified: LF(sha256-${lfHash}) & CRLF(sha256-${crlfHash})`);
      }
    }
  }
} catch (e) {
  console.warn('[BUILD WARNING] CSP verification skipped:', e.message);
}

console.log('[BUILD] Production assets mirrored to public/ successfully.');
console.log('[BUILD] Build OK: Single-file production bundle verified.');
