import { describe, expect, it } from 'vitest';
import { splitMentions, unmentioned, type MentionEntity } from './mentions';

const film = (id: number, name: string): MentionEntity => ({ kind: 'film', id, name, image: null });
const person = (id: number, name: string): MentionEntity => ({ kind: 'person', id, name, image: null });

describe('splitMentions', () => {
  it('marks both films in a two-film starter', () => {
    const segs = splitMentions('Blink Twice vs Get Out: which one hits harder?', [film(1, 'Blink Twice'), film(2, 'Get Out')]);
    expect(segs.filter((s) => 'entity' in s).map((s) => s.text)).toEqual(['Blink Twice', 'Get Out']);
    expect(segs.map((s) => s.text).join('')).toBe('Blink Twice vs Get Out: which one hits harder?');
  });

  it('prefers the longest name and matches each entity once', () => {
    const segs = splitMentions('Dune: Part Two beats Dune. Dune: Part Two rules.', [film(1, 'Dune'), film(2, 'Dune: Part Two')]);
    const marked = segs.filter((s) => 'entity' in s) as { entity: MentionEntity }[];
    expect(marked.map((s) => s.entity.id)).toEqual([2, 1]);
  });

  it('does not match inside other words', () => {
    expect(splitMentions('Heathers is not Heat', [film(1, 'Heat')]).filter((s) => 'entity' in s)).toHaveLength(1);
  });

  it('marks people and reports entities the text never names', () => {
    const entities = [person(5, 'Channing Tatum'), film(9, 'Magic Mike')];
    expect(splitMentions('channing tatum plays against type', entities)[0]).toMatchObject({ entity: { id: 5 } });
    expect(unmentioned('Channing Tatum is great', entities).map((e) => e.id)).toEqual([9]);
  });
});
