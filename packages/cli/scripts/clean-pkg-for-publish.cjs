#!/usr/bin/env node
// Removes workspace-only devDependencies from package.json before npm publish.
// These packages don't exist on npm (shared is bundled, dashboard is build-only).
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

delete pkg.devDependencies['@juststore/shared'];
delete pkg.devDependencies['@juststore/dashboard'];

// Clean up if empty
if (pkg.devDependencies && Object.keys(pkg.devDependencies).length === 0) {
  delete pkg.devDependencies;
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Cleaned workspace devDeps from package.json');
