#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { spawn } from 'node:child_process';

function git(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

git('git fetch origin main');
const head = git('git rev-parse HEAD');
const main = git('git rev-parse origin/main');
if (head !== main) {
  console.error(`deploy: HEAD ${head} is not origin/main ${main}. Merge a PR to main and let Vercel GitHub ship production.`);
  process.exit(1);
}

const child = spawn('npx', ['vercel', '--prod', ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
