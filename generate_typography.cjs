const fs = require('fs');
const path = require('path');

const fonts = [
  { name: 'Lora', path: 'node_modules/@fontsource/lora/files/lora-latin-400-normal.woff2', weight: 400, style: 'normal' },
  { name: 'Lora', path: 'node_modules/@fontsource/lora/files/lora-latin-700-normal.woff2', weight: 700, style: 'normal' },
  { name: 'Lora', path: 'node_modules/@fontsource/lora/files/lora-latin-400-italic.woff2', weight: 400, style: 'italic' },
  { name: 'Caveat', path: 'node_modules/@fontsource/caveat/files/caveat-latin-400-normal.woff2', weight: 400, style: 'normal' },
  { name: 'Caveat', path: 'node_modules/@fontsource/caveat/files/caveat-latin-700-normal.woff2', weight: 700, style: 'normal' },
];

let css = `/* Typography & Branding Styles */

:root {
  --gold: #c9a14a;
}

`;

for (const font of fonts) {
  const fontPath = path.join(__dirname, font.path);
  const base64 = fs.readFileSync(fontPath).toString('base64');
  css += `@font-face {
  font-family: '${font.name}';
  src: url(data:font/woff2;charset=utf-8;base64,${base64}) format('woff2');
  font-weight: ${font.weight};
  font-style: ${font.style};
  font-display: swap;
}\n\n`;
}

css += `
body {
  font-family: 'Lora', serif;
}

.chapter-content-page .wisdom-text > p:first-of-type::first-letter {
  font-size: 4rem;
  float: left;
  color: var(--gold);
  line-height: 1;
  margin-right: 0.1em;
}

blockquote, .chapter-quote {
  border-left: 4px solid var(--gold);
  padding-left: 1.5em;
  margin-left: 0;
  margin-bottom: 2em;
  font-style: italic;
  font-size: 1.1em;
  color: #444;
}

.chapter-quote .attribution {
  display: block;
  text-align: right;
  font-style: normal;
  font-size: 0.9em;
  color: #666;
  margin-top: 0.5em;
}

.memory-text {
  font-family: 'Caveat', cursive;
  font-size: 1.5em;
  color: #333;
}

.chapter-label {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 10pt;
  color: #888;
  margin-bottom: 1em;
}

.gold-separator {
  border: none;
  border-top: 1px solid var(--gold);
  width: 40px;
  margin: 1.5em auto;
}

.cover-frame {
  border: 2px solid var(--gold);
  padding: 2px;
  width: 90%;
  height: 90%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.cover-inner {
  border: 1px solid var(--gold);
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 2em;
}
`;

fs.writeFileSync(path.join(__dirname, 'src/features/pdf/styles/typography.css'), css);
console.log('typography.css generated successfully.');
