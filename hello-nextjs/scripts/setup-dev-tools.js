const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, 'browser-dev-tools.js');
const destDir = path.join(__dirname, '..', 'public', 'scripts');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const destFile = path.join(destDir, 'browser-dev-tools.js');

if (fs.existsSync(sourceFile)) {
  fs.copyFileSync(sourceFile, destFile);
  console.log('✅ Browser dev tools copied to public/scripts/');
} else {
  console.error('❌ Source file not found:', sourceFile);
}
