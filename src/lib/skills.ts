// Skill files loaded as raw strings at build time via Vite's ?raw suffix.
// Each skill is a markdown document (Role / Instructions / Examples / Constraints).
// Usage: import { loadSkill } from '../lib/skills'; const system = loadSkill('movie-hook');

import movieHook from '../skills/movie-hook.md?raw';
import tasteInsight from '../skills/taste-insight.md?raw';
import onboardingAi from '../skills/onboarding-ai.md?raw';
import movieChat from '../skills/movie-chat.md?raw';
import searchIntent from '../skills/search-intent.md?raw';

const SKILLS: Record<string, string> = {
  'movie-hook': movieHook,
  'taste-insight': tasteInsight,
  'onboarding-ai': onboardingAi,
  'movie-chat': movieChat,
  'search-intent': searchIntent,
};

export function loadSkill(name: string): string {
  const content = SKILLS[name];
  if (!content) console.warn(`Skill not found: ${name}`);
  return content ?? '';
}

export type SkillName = keyof typeof SKILLS;
