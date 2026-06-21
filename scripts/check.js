const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const sourceDirectories = ['public/js', 'src', 'scripts', 'test'];

function findJavaScriptFiles(directory) {
  const absoluteDirectory = path.join(projectRoot, directory);
  if (!fs.existsSync(absoluteDirectory)) return [];

  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap(entry => {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findJavaScriptFiles(relativePath);
    return entry.name.endsWith('.js') ? [relativePath] : [];
  });
}

const files = sourceDirectories.flatMap(findJavaScriptFiles);
const failures = [];

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: projectRoot,
    encoding: 'utf8'
  });

  if (result.status !== 0) failures.push(`${file}\n${result.stderr.trim()}`);
}

if (failures.length) {
  console.error(`Syntax check failed:\n\n${failures.join('\n\n')}`);
  process.exit(1);
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);
