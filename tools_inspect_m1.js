const fs = require('fs');
const content = fs.readFileSync('module1_verification_tests.js', 'utf8');
console.log(content.substring(0, 1000));
