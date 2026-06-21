const fs = require('node:fs');
const path = require('node:path');

const file = path.resolve(__dirname, '..', 'public', 'css', 'styles.css');
const source = fs.readFileSync(file, 'utf8');

let output = '';
let token = '';
let indent = 0;
let quote = null;
let parentheses = 0;

const indentation = () => '  '.repeat(indent);

function writeToken(suffix = '') {
  const text = token.trim();
  if (text) output += indentation() + text + suffix;
  token = '';
}

for (let index = 0; index < source.length; index += 1) {
  const character = source[index];
  const previous = source[index - 1];

  if (quote) {
    token += character;
    if (character === quote && previous !== '\\') quote = null;
    continue;
  }

  if (character === '"' || character === "'") {
    quote = character;
    token += character;
  } else if (character === '(') {
    parentheses += 1;
    token += character;
  } else if (character === ')') {
    parentheses -= 1;
    token += character;
  } else if (character === '{' && parentheses === 0) {
    writeToken(' {\n');
    indent += 1;
  } else if (character === ';' && parentheses === 0) {
    writeToken(';\n');
  } else if (character === '}' && parentheses === 0) {
    writeToken('\n');
    indent = Math.max(0, indent - 1);
    output += `${indentation()}}\n\n`;
  } else {
    token += character;
  }
}

writeToken('\n');

// Add a space after declaration colons without changing pseudo-selectors.
output = output
  .split('\n')
  .map(line => {
    const spacedLine = line
      .replace(/,(?!\s)/g, ', ')
      .replace(/^@media\(/, '@media (')
      .replace(/^(@media \([^:]+):\s*/, '$1: ');
    if (spacedLine.trimEnd().endsWith('{') || !spacedLine.includes(':')) return spacedLine;
    const declaration = spacedLine
      .replace(/^([ ]*(?:--)?[\w-]+):\s*/, '$1: ')
      .replace(/\s*!important/g, ' !important')
      .replace(/,(?!\s)/g, ', ');
    return declaration.trimEnd().endsWith(';') ? declaration : `${declaration};`;
  })
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trimEnd() + '\n';

fs.writeFileSync(file, output);
