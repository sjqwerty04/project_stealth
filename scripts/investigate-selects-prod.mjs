#!/usr/bin/env node
import { createRequire } from 'node:module';

const PROD_PROJECT = 'mvplockedin';

function fail(code, message) {
  console.error(message);
  process.exit(code);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  fail(2, 'investigate-selects-prod: blocked. Set GOOGLE_APPLICATION_CREDENTIALS to a mvplockedin service account.');
}

const require = createRequire(import.meta.url);
let admin;
try {
  admin = require('firebase-admin');
} catch {
  fail(2, 'investigate-selects-prod: blocked. firebase-admin is not installed.');
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

const projectId = admin.app().options.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
if (projectId && projectId !== PROD_PROJECT) {
  fail(2, `investigate-selects-prod: blocked. Project is ${projectId}, expected ${PROD_PROJECT}.`);
}

function firstSentence(text) {
  const trimmed = String(text || '').trim();
  const match = trimmed.match(/^.+?[.!?]+/);
  return (match ? match[0] : trimmed).trim().toLowerCase();
}

function hasPoster(row) {
  return Boolean(row && String(row.title || '').trim() && String(row.poster || '').trim());
}

const db = admin.firestore();
const usersSnap = await db.collection('users').get();
const summary = {
  projectId: projectId || PROD_PROJECT,
  userCount: usersSnap.size,
  lastPicksUsers: 0,
  missingCalendarPoster: 0,
  relatedTitleMismatch: 0,
  watchedStillInLastPicks: 0,
  historyStillInLastPicks: 0,
  canonHits: { 1538: 0, 395840: 0, 9366: 0 },
};

for (const userDoc of usersSnap.docs) {
  const uid = userDoc.id;
  const taste = await db.doc(`users/${uid}/taste/current`).get();
  const lastPicks = taste.exists ? taste.data()?.generated?.lastPicks : null;
  if (!Array.isArray(lastPicks) || !lastPicks.length) continue;
  summary.lastPicksUsers += 1;

  const [filmsSnap, logsSnap] = await Promise.all([
    db.collection(`users/${uid}/films`).get(),
    db.collection(`users/${uid}/calendar_logs`).get(),
  ]);
  const films = filmsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const logs = logsSnap.docs.map((d) => d.data());
  const history = taste.data()?.context?.history ?? [];
  const watchedIds = new Set(
    films.filter((f) => f.watched === true).map((f) => String(f.movieId ?? f.id)),
  );

  for (const pick of lastPicks) {
    const id = Number(pick?.movieId);
    if (id === 1538 || id === 395840 || id === 9366) summary.canonHits[id] += 1;
    const why = firstSentence(pick.whyMatch || '');
    const calendarHits = logs.filter((row) => hasPoster(row) && why.includes(String(row.title).toLowerCase()));
    const libraryHits = films.filter((row) => hasPoster(row) && why.includes(String(row.title).toLowerCase()));
    if (libraryHits.length > calendarHits.length) summary.missingCalendarPoster += 1;
    const libraryTitles = new Set(libraryHits.map((row) => String(row.title)));
    if (calendarHits.some((row) => !libraryTitles.has(String(row.title)))) summary.relatedTitleMismatch += 1;
    if (watchedIds.has(String(id))) summary.watchedStillInLastPicks += 1;
    if (
      history.some(
        (h) => String(h.id) === String(id) || String(h.item || '').toLowerCase() === String(pick.title || '').toLowerCase(),
      )
    ) {
      summary.historyStillInLastPicks += 1;
    }
  }
}

console.log(JSON.stringify(summary, null, 2));
