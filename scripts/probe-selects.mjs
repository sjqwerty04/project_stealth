#!/usr/bin/env node
const base = process.argv[2];
if (!base) {
  console.error('usage: node scripts/probe-selects.mjs <preview-origin>');
  process.exit(64);
}

const recRes = await fetch(`${base}/api/your-selects`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    context: {
      history: [{ item: 'The Odyssey', rating: 3 }, { item: 'X-Men', rating: 3 }],
    },
  }),
});
const recBody = await recRes.json();
const picks = Array.isArray(recBody.picks) ? recBody.picks : [];
const lookups = [];
for (const pick of picks) {
  const url = new URL(`${base}/api/movie-lookup`);
  url.searchParams.set('title', pick.title);
  if (pick.year) url.searchParams.set('year', String(pick.year));
  const look = await fetch(url);
  const body = await look.json();
  lookups.push({ title: pick.title, whyMatch: pick.whyMatch || '', lookup: look.status, id: body.id || null });
}

console.log(JSON.stringify({ status: recRes.status, source: recBody.source, pickCount: picks.length, lookups }, null, 2));
if (recRes.status !== 200 || !picks.length) process.exit(1);
if (lookups.some((row) => !row.id)) process.exit(2);
