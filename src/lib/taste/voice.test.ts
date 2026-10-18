import { describe, expect, it } from 'vitest';
import { applyTasteEvent } from './applyEvent';
import { emptySnapshot } from './buildRecommendContext';
import { tasteVoice } from './voice';

describe('tasteVoice', () => {
  it('names the live dislike from a Not Interested skip', () => {
    const next = applyTasteEvent(
      applyTasteEvent(
        emptySnapshot(),
        {
          type: 'onboarding',
          favoriteFilms: [{ title: 'Heat' }],
          dislikedFilms: [],
          axis: 'story',
          personaLine: 'Night drives.',
        },
        'e0',
      ),
      { type: 'skip', movieId: 12, title: 'The Room' },
      'e1',
    );
    const voice = tasteVoice(next);
    expect(voice.lead).toBe('Night drives.');
    expect(voice.profileBody).toContain('Heat');
    expect(voice.profileBody).toContain('The Room');
    expect(voice.leave).toEqual(['The Room']);
    expect(voice.settingsLead).toContain('The Room');
    expect(voice.settingsBody).toContain('The Room');
    expect(`${voice.lead} ${voice.profileBody} ${voice.settingsLead} ${voice.settingsBody}`).not.toMatch(/[—–]/);
  });

  it('does not invent a watchlist slogan when the taste is empty', () => {
    const voice = tasteVoice(emptySnapshot());
    expect(voice.empty).toBe(true);
    expect(voice.lead).toBe('No marks in this taste yet.');
    expect(voice.settingsBody).toContain('no likes or dislikes');
    expect(voice.profileBody).not.toMatch(/watch some films/i);
    expect(voice.importLine).toBe('New history becomes the first mark.');
  });
});
