const fs = require('fs');
const path = require('path');

// List all files in the src directory
const srcDir = path.join(__dirname, 'frontend', 'src');
console.log('Files in src directory:');
fs.readdirSync(srcDir).forEach(file => {
  console.log(' - ' + file);
});

// Check if App.tsx exists (case sensitive)
const appPath = path.join(srcDir, 'App.tsx');
console.log(`\nDoes ${appPath} exist?`, fs.existsSync(appPath));

// Check if app.tsx exists (lowercase)
const appLowerPath = path.join(srcDir, 'app.tsx');
console.log(`Does ${appLowerPath} exist?`, fs.existsSync(appLowerPath));

// Print content of index.tsx to see what it's importing
const indexPath = path.join(srcDir, 'index.tsx');
console.log('\nContent of index.tsx:');
if (fs.existsSync(indexPath)) {
  console.log(fs.readFileSync(indexPath, 'utf8'));
}