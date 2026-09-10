import { readFileSync } from 'fs';
import { join } from 'path';

export function readSkill(name: string): string {
  const candidates = [
    join(process.cwd(), 'src/skills', `${name}.md`),
    join(process.cwd(), 'skills', `${name}.md`),
  ];
  for (const path of candidates) {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      continue;
    }
  }
  return '';
}
