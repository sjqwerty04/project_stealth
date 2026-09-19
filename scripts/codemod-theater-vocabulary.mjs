#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const SCAN_DIRS = ['src', 'e2e', 'api', 'admin-dashboard'];
const SCAN_FILES = ['README.md', 'agent.md', 'firestore.rules', 'index.html'];
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.md', '.py', '.rules', '.html']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

const RENAMES = [
  ['src/screens/SavedVibesScreen.tsx', 'src/screens/TheatersScreen.tsx'],
  ['src/components/PatternAssistant.tsx', 'src/components/TheaterCard.tsx'],
  ['src/contexts/ExplorationContext.tsx', 'src/contexts/TheaterContext.tsx'],
  ['src/hooks/useSimilarVibes.ts', 'src/hooks/useSimilarFilms.ts'],
];

const ALLOWED = [
  { path: 'src/lib/orbitEngine.ts', reason: 'Orbit keeps its vibe wording' },
  { path: 'src/components/orbit/', reason: 'Orbit keeps Vibe and Vibe Match' },
  { path: 'src/lib/legacyTheaters.ts', reason: 'named legacy adapter for the saved_vibes collection and the /vibes and /rooms redirects' },
  { path: 'firestore.rules', reason: 'retains the saved_vibes owner rule until copy-forward lands' },
  { path: 'admin-dashboard/pages/2_Activity.py', reason: 'displays legacy vibe_saved activity rows' },
];

const FORBIDDEN = [
  { name: 'vibe', pattern: /vibe/i },
  { name: 'Rooms product label', pattern: /\bRooms\b/ },
  { name: 'rooms route', pattern: /["'`]\/rooms\b/ },
];

const REPLACEMENTS = [
  ["{vibeSaved ? 'Saved!' : 'Save vibe'}", "{theaterKept ? 'Kept!' : 'Keep Theater'}"],
  ["{vibeSaved ? 'Saved' : 'Save'}", "{theaterKept ? 'Kept' : 'Keep'}"],
  ['More films matching this vibe', 'More films in this Theater'],
  ['Show pattern vibe', 'Show Theater'],
  ['Vibe Check', 'Mood Check'],
  ['Finding similar vibes…', 'Finding similar films…'],
  ['Similar vibes prompt', 'Similar films prompt'],
  ['System prompt for similar vibes', 'System prompt for similar films'],
  ['Saved Vibes', 'Theaters'],
  ['No saved vibes yet', 'No Theaters yet'],
  ['No more vibes', 'No more Theaters'],
  ['Failed to fetch vibes:', 'Failed to fetch Theaters:'],
  ['Failed to delete vibe:', 'Failed to delete Theater:'],
  ['Failed to save vibe:', 'Failed to keep Theater:'],
  ['Show modal with all movies in the vibe', 'Show modal with all movies in the Theater'],
  ['specific vibes, themes, and aesthetics', 'specific moods, themes, and aesthetics'],
  ['within an ExplorationProvider', 'within a TheaterProvider'],
  ['AI-Generated Vibe List', 'AI-generated curated list'],
  ['Vibe loading state', 'Curated list loading state'],
  ['personalized vibes', 'personalized curated lists'],
  ['personalized vibe list', 'personalized curated list'],
  ['Failed to generate vibe list:', 'Failed to generate curated list:'],
  ['Failed to hydrate vibe movie:', 'Failed to hydrate curated list movie:'],
  ['Failed to parse vibe response:', 'Failed to parse curated list response:'],
  ['description of the vibe/theme', 'description of the theme'],
  ['Brief description of the vibe', 'Brief description of the theme'],
  ['only reference vibe, genre, reputation, or director\'s style', 'only reference mood, genre, reputation, or director\'s style'],
  ['only reference reputation or vibe', 'only reference reputation or mood'],
  ['Personalized vibe lists', 'Personalized curated lists'],
  ['search vibes', 'curated search lists'],
  ['imports, saved vibes, watched timelines', 'imports, kept Theaters, watched timelines'],
  ['Persist history, skips, vibes, watchlist.', 'Persist history, skips, Theaters, watchlist.'],
  ['logic and vibe intelligence', 'logic and Theater intelligence'],
  ['adjacent recommendations/vibe graph behavior', 'similar-film recommendations for movie detail'],
  ['saved preference pattern retrieval', 'kept Theater retrieval'],
  [
    '- `saved_vibes`: persisted taste-profile snapshots.',
    '- `theaters`: kept Theaters. Until copy-forward lands, reads and writes still go to the legacy collection through `src/lib/legacyTheaters.ts`.',
  ],
  ['- `ProfileDropdown.tsx`: account controls.\n', ''],
  ['SavedVibesScreen', 'TheatersScreen'],
  ['useSimilarVibes', 'useSimilarFilms'],
  ['PatternAssistant', 'TheaterCard'],
  ['ExplorationContext', 'TheaterContext'],
  ['ExplorationProvider', 'TheaterProvider'],
  [/useExploration\b/g, 'useTheater'],
  ['SaveVibe', 'KeepTheater'],
  ['saveVibe', 'keepTheater'],
  ['SavingVibe', 'KeepingTheater'],
  ['VibeSaved', 'TheaterKept'],
  ['vibeSaved', 'theaterKept'],
  ['vibe_saved', 'theater_kept'],
  ['vibesRef', 'theatersRef'],
  ['fetchedVibes', 'fetchedTheaters'],
  ['fetchVibes', 'fetchTheaters'],
  ['setVibes', 'setTheaters'],
  ['SelectedVibe', 'SelectedTheater'],
  ['selectedVibe', 'selectedTheater'],
  ['handleVibeClick', 'handleTheaterClick'],
  ['vibeId', 'theaterId'],
  ['SavedVibe', 'KeptTheater'],
  ['VibeList', 'CuratedList'],
  ['vibeList', 'curatedList'],
  ['IsLoadingVibe', 'IsLoadingCuratedList'],
  ['isLoadingVibe', 'isLoadingCuratedList'],
  ['vibePrompt', 'curatedListPrompt'],
  ['vibeData', 'curatedListData'],
  ["{ label: 'Rooms', meta: 'Lists you keep', to: '/watchlist' }", "{ label: 'Lists', meta: 'Lists you keep', to: '/watchlist' }"],
  [/\bVibes\b/g, 'Theaters'],
  [/\bvibes\b/g, 'theaters'],
  [/\bVibe\b/g, 'Theater'],
  [/\bvibe\b/g, 'theater'],
];

function parseArgs(argv) {
  const args = { check: false, root: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--check') args.check = true;
    else if (argv[i] === '--root') args.root = path.resolve(argv[++i] ?? '');
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return args;
}

function toPosix(relative) {
  return relative.split(path.sep).join('/');
}

function isAllowed(relative) {
  return ALLOWED.some((entry) =>
    entry.path.endsWith('/') ? relative.startsWith(entry.path) : relative === entry.path,
  );
}

function* walk(root, dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(root, full);
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      yield toPosix(path.relative(root, full));
    }
  }
}

function scanTargets(root) {
  const files = [];
  for (const dir of SCAN_DIRS) {
    const full = path.join(root, dir);
    if (fs.existsSync(full)) files.push(...walk(root, full));
  }
  for (const file of SCAN_FILES) {
    if (fs.existsSync(path.join(root, file))) files.push(file);
  }
  return files;
}

function renameFiles(root) {
  const renamed = [];
  for (const [from, to] of RENAMES) {
    const fromPath = path.join(root, from);
    const toPath = path.join(root, to);
    if (!fs.existsSync(fromPath)) continue;
    if (fs.existsSync(toPath)) throw new Error(`both ${from} and ${to} exist; resolve by hand`);
    fs.renameSync(fromPath, toPath);
    renamed.push([from, to]);
  }
  return renamed;
}

function applyReplacements(text) {
  let out = text;
  for (const [from, to] of REPLACEMENTS) {
    out = typeof from === 'string' ? out.split(from).join(to) : out.replace(from, to);
  }
  return out;
}

function rewrite(root) {
  const renamed = renameFiles(root);
  for (const [from, to] of renamed) console.log(`renamed ${from} -> ${to}`);
  let changed = renamed.length;
  for (const relative of scanTargets(root)) {
    if (isAllowed(relative)) continue;
    const full = path.join(root, relative);
    const before = fs.readFileSync(full, 'utf8');
    const after = applyReplacements(before);
    if (after === before) continue;
    fs.writeFileSync(full, after);
    console.log(`rewrote ${relative}`);
    changed += 1;
  }
  console.log(`Theater vocabulary rewrite: ${changed} files changed`);
}

function check(root) {
  const violations = [];
  for (const relative of scanTargets(root)) {
    if (isAllowed(relative)) continue;
    const lines = fs.readFileSync(path.join(root, relative), 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (FORBIDDEN.some((rule) => rule.pattern.test(line))) {
        violations.push({ relative, line: index + 1, text: line.trim() });
      }
    });
  }
  if (violations.length === 0) {
    console.log('Theater vocabulary OK');
    return 0;
  }
  for (const v of violations) console.log(`${v.relative}:${v.line}: ${v.text}`);
  const files = new Set(violations.map((v) => v.relative)).size;
  console.log(
    `Theater vocabulary: ${violations.length} violation${violations.length === 1 ? '' : 's'} in ${files} file${files === 1 ? '' : 's'}`,
  );
  return 1;
}

const args = parseArgs(process.argv.slice(2));
if (!args.check) rewrite(args.root);
process.exit(check(args.root));
