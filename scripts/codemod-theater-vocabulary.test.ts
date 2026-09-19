import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('./codemod-theater-vocabulary.mjs', import.meta.url));
const roots: string[] = [];

function fixtureRoot(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'theater-vocab-'));
  roots.push(root);
  for (const [relative, text] of Object.entries(files)) {
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  }
  return root;
}

function run(root: string, ...flags: string[]) {
  const result = spawnSync(process.execPath, [SCRIPT, ...flags, '--root', root], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('check', () => {
  it('fails on Saved Vibes in a non-Orbit file and names the path and line', () => {
    const root = fixtureRoot({
      'src/screens/Archive.tsx': 'export default function Archive() {\n  return <h1>Saved Vibes</h1>;\n}\n',
    });
    const { status, stdout } = run(root, '--check');
    expect(status).toBe(1);
    expect(stdout).toContain('src/screens/Archive.tsx:2: return <h1>Saved Vibes</h1>;');
    expect(stdout).toContain('Theater vocabulary: 1 violation in 1 file');
  });

  it('passes Vibe Match in an Orbit file', () => {
    const root = fixtureRoot({
      'src/components/orbit/OrbitCardStack.tsx': "const hint = 'Vibe Match';\nexport default hint;\n",
    });
    const { status, stdout } = run(root, '--check');
    expect(status).toBe(0);
    expect(stdout.trim()).toBe('Theater vocabulary OK');
  });

  it('fails on a /rooms route literal outside the legacy adapter', () => {
    const root = fixtureRoot({
      'src/components/Bar.tsx': "navigate('/rooms');\n",
      'src/lib/legacyTheaters.ts': "export const LEGACY_THEATER_ROUTES = ['/vibes', '/rooms'];\n",
    });
    const { status, stdout } = run(root, '--check');
    expect(status).toBe(1);
    expect(stdout).toContain("src/components/Bar.tsx:1: navigate('/rooms');");
    expect(stdout).not.toContain('legacyTheaters');
  });

  it('fails on a Rooms product label but keeps ordinary room prose', () => {
    const root = fixtureRoot({
      'src/components/Library.tsx':
        "const rows = [{ label: 'Rooms', to: '/watchlist' }];\n" +
        "const onboarding = 'The room and the projection';\n",
    });
    const { status, stdout } = run(root, '--check');
    expect(status).toBe(1);
    expect(stdout).toContain("src/components/Library.tsx:1: const rows = [{ label: 'Rooms', to: '/watchlist' }];");
    expect(stdout).not.toContain('The room and the projection');
  });
});

describe('rewrite', () => {
  it('renames files, rewrites text to literal Theater vocabulary, and converges on a second run', () => {
    const root = fixtureRoot({
      'src/screens/SavedVibesScreen.tsx': 'export default function SavedVibesScreen() {\n  return <h1>Saved Vibes</h1>;\n}\n',
      'src/components/Card.tsx':
        "<button onClick={onSaveVibe}>{vibeSaved ? 'Saved!' : 'Save vibe'}</button>\n" +
        "const { saveVibe, isSavingVibe } = useExploration();\n",
      'src/components/orbit/OrbitControls.tsx': "const copy = 'Vibe Match - Similar mood & feel';\n",
    });

    const first = run(root);
    expect(first.status).toBe(0);
    expect(first.stdout).toContain('renamed src/screens/SavedVibesScreen.tsx -> src/screens/TheatersScreen.tsx');
    expect(first.stdout).toContain('Theater vocabulary rewrite: 3 files changed');
    expect(first.stdout).toContain('Theater vocabulary OK');
    expect(fs.existsSync(path.join(root, 'src/screens/SavedVibesScreen.tsx'))).toBe(false);
    expect(fs.readFileSync(path.join(root, 'src/screens/TheatersScreen.tsx'), 'utf8')).toBe(
      'export default function TheatersScreen() {\n  return <h1>Theaters</h1>;\n}\n',
    );
    expect(fs.readFileSync(path.join(root, 'src/components/Card.tsx'), 'utf8')).toBe(
      "<button onClick={onKeepTheater}>{theaterKept ? 'Kept!' : 'Keep Theater'}</button>\n" +
        "const { keepTheater, isKeepingTheater } = useTheater();\n",
    );
    expect(fs.readFileSync(path.join(root, 'src/components/orbit/OrbitControls.tsx'), 'utf8')).toBe(
      "const copy = 'Vibe Match - Similar mood & feel';\n",
    );

    const second = run(root);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain('Theater vocabulary rewrite: 0 files changed');
    expect(second.stdout).toContain('Theater vocabulary OK');
  });
});
