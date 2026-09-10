import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'docs', 'ios']);
const BANNED = [
  /VITE_CLAUDE_API_KEY/,
  /VITE_GEMINI_API_KEY/,
  /OPENROUTER_API_KEY/,
  /api\.anthropic\.com/,
  /openrouter\.ai/,
  /callClaude/,
  /callGemini/,
  /callAnthropic/,
  /callOpenRouter/,
  /\/api\/claude/,
];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    if (name === 'assert-no-legacy-llm.mjs') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const hits = [];
for (const file of walk(ROOT)) {
  if (!/\.(ts|tsx|js|mjs|json|md|example)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const re of BANNED) {
    if (re.test(text)) hits.push(`${file} matches ${re}`);
  }
}

if (hits.length) {
  console.error(hits.join('\n'));
  process.exit(1);
}
console.log('assert-no-legacy-llm: ok');
