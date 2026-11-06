const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function getTestFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getTestFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

const testDir = path.resolve(__dirname, '../tests/unit');
const testFiles = getTestFiles(testDir);

if (testFiles.length === 0) {
  console.error(`No test files found in ${testDir}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..')
});

process.exit(result.status ?? 1);
