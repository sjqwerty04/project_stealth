import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const results = path.join(root, 'test-results');
const destRoot = path.join(root, 'artifacts', 'verify');

if (!fs.existsSync(results)) process.exit(0);

for (const dir of fs.readdirSync(results)) {
  const full = path.join(results, dir);
  if (!fs.statSync(full).isDirectory()) continue;
  const named = dir.match(/(F\d+|F-smoke-[a-z]+).*(mobile|desktop)$/);
  if (!named) continue;
  const id = named[1];
  const viewport = named[2];
  const dest = path.join(destRoot, `${id}-${viewport}`);
  fs.mkdirSync(dest, { recursive: true });
  const video = path.join(full, 'video.webm');
  if (fs.existsSync(video)) fs.copyFileSync(video, path.join(dest, 'flow.webm'));
  let still = 0;
  for (const file of fs.readdirSync(full)) {
    if (!file.endsWith('.png')) continue;
    still += 1;
    fs.copyFileSync(path.join(full, file), path.join(dest, `run-still-${still}.png`));
  }
}

console.log('copied videos into artifacts/verify');
