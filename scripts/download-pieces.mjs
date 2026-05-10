import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'pieces');

const pieces = {
  wK: 'Chess_klt45.svg',
  wQ: 'Chess_qlt45.svg',
  wR: 'Chess_rlt45.svg',
  wB: 'Chess_blt45.svg',
  wN: 'Chess_nlt45.svg',
  wP: 'Chess_plt45.svg',
  bK: 'Chess_kdt45.svg',
  bQ: 'Chess_qdt45.svg',
  bR: 'Chess_rdt45.svg',
  bB: 'Chess_bdt45.svg',
  bN: 'Chess_ndt45.svg',
  bP: 'Chess_pdt45.svg'
};

await mkdir(outDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function downloadSvg(file) {
  const url = `https://commons.wikimedia.org/wiki/Special:Redirect/file/${file}`;
  let lastError;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'chessfish/0.1.0 (development asset downloader)'
      },
      redirect: 'follow'
    });

    if (response.ok) {
      return response.text();
    }

    lastError = new Error(`Failed to download ${file}: ${response.status} ${response.statusText}`);
    if (response.status !== 429 && response.status < 500) {
      throw lastError;
    }

    await sleep(1000 * (attempt + 1));
  }

  throw lastError;
}

for (const [name, file] of Object.entries(pieces)) {
  const svg = await downloadSvg(file);
  if (!svg.includes('<svg')) {
    throw new Error(`Downloaded ${file}, but it did not look like SVG`);
  }

  await writeFile(path.join(outDir, `${name}.svg`), svg);
  await sleep(350);
}

await writeFile(
  path.join(outDir, 'ATTRIBUTION.md'),
  [
    '# Chess Piece Icons',
    '',
    'The chess piece SVGs are the Cburnett chess set from Wikimedia Commons.',
    '',
    'Source pattern: https://commons.wikimedia.org/wiki/File:Chess_klt45.svg',
    '',
    'License: Creative Commons Attribution-Share Alike 3.0 Unported.',
    ''
  ].join('\n')
);

console.log(`Downloaded ${Object.keys(pieces).length} chess piece SVGs to ${path.relative(root, outDir)}`);
