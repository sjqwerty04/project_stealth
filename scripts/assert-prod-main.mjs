#!/usr/bin/env node
import { execSync } from 'node:child_process';

const PROD_URL = process.env.SELECTS_PROD_URL || 'https://selects-film.vercel.app';
const PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_uPg3fPiGynB9lFnfwXBnRm4IZ9J8';
const TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_F9UJULDQrBjueLnwoqbhfMna';

function git(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

git('git fetch origin main');
const mainSha = git('git rev-parse origin/main');

function sameSha(a, b) {
  if (!a || !b) return false;
  return a.startsWith(b) || b.startsWith(a);
}

async function shaFromHtml() {
  try {
    const html = await fetch(PROD_URL).then((r) => r.text());
    const m = html.match(/name=["']selects-sha["']\s+content=["']([^"']+)["']/i);
    return m?.[1] && m[1] !== 'unknown' ? m[1] : null;
  } catch {
    return null;
  }
}

function vercelHeaders() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

async function shaFromApi() {
  const headers = vercelHeaders();
  if (!headers) return null;
  const url = new URL('https://api.vercel.com/v6/deployments');
  url.searchParams.set('projectId', PROJECT_ID);
  url.searchParams.set('target', 'production');
  url.searchParams.set('limit', '20');
  url.searchParams.set('teamId', TEAM_ID);
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  const ready = (data.deployments || []).find(
    (d) => d.state === 'READY' && d.target === 'production' && d.meta?.githubCommitSha,
  );
  return ready?.meta?.githubCommitSha ?? null;
}

async function productionBranchFromApi() {
  const headers = vercelHeaders();
  if (!headers) return null;
  const url = new URL(`https://api.vercel.com/v9/projects/${PROJECT_ID}`);
  url.searchParams.set('teamId', TEAM_ID);
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  return data.link?.productionBranch ?? null;
}

const htmlSha = await shaFromHtml();
const apiSha = await shaFromApi();
const envSha = process.env.SELECTS_PROD_SHA || null;
const prodSha = htmlSha || apiSha || envSha;
const productionBranch = (await productionBranchFromApi()) || 'main';

console.log(
  JSON.stringify(
    {
      originMain: mainSha,
      prodHtml: htmlSha,
      prodApi: apiSha,
      prodUsed: prodSha,
      productionBranch,
    },
    null,
    2,
  ),
);

if (productionBranch !== 'main') {
  console.error(`assert-prod-main: productionBranch is ${productionBranch}, expected main`);
  process.exit(1);
}

if (!prodSha) {
  console.error('assert-prod-main: could not read production SHA (set VERCEL_TOKEN or SELECTS_PROD_SHA)');
  process.exit(2);
}

if (!sameSha(mainSha, prodSha)) {
  console.error(`assert-prod-main: origin/main ${mainSha} != prod ${prodSha}`);
  process.exit(1);
}

console.log('assert-prod-main: origin/main matches production');
