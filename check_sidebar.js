const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const sIdx = html.indexOf('<aside class="sidebar"');
const endIdx = html.indexOf('</aside>');
console.log(html.substring(sIdx, endIdx + 8));
