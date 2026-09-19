import { describe, expect, it, vi } from 'vitest';
import {
  executeSelectReplacement,
  replacePickAtSlot,
  replacementConflictsWithSiblings,
} from './selectReplacement';

type Pick = { movieId: number; title: string };
type RawPick = { title: string; id: string };

const picks: [Pick, Pick, Pick] = [
  { movieId: 1, title: 'Heat' },
  { movieId: 2, title: 'Zodiac' },
  { movieId: 3, title: 'Thief' },
];

describe('select replacement', () => {
  it('patches one stable slot without changing its siblings', () => {
    expect(replacePickAtSlot(picks, 1, { movieId: 4, title: 'Manhunter' })).toEqual([
      { movieId: 1, title: 'Heat' },
      { movieId: 4, title: 'Manhunter' },
      { movieId: 3, title: 'Thief' },
    ]);
  });

  it('excludes every visible card and persists one replacement', async () => {
    const requestPick = vi.fn(async () => [{ title: 'Manhunter', id: '4' }]);
    const persistPicks = vi.fn(async () => {});

    const next = await executeSelectReplacement<Pick, RawPick, { profile: string }>({
      slotId: 1,
      picks,
      feedbackSaved: true,
      saveFeedback: vi.fn(async () => {}),
      onFeedbackSaved: vi.fn(),
      readContext: async () => ({ profile: 'crime' }),
      requestPicks: requestPick,
      hydratePick: async () => ({ movieId: 4, title: 'Manhunter' }),
      persistPicks,
    });

    expect(requestPick).toHaveBeenCalledWith(
      { profile: 'crime' },
      [
        { id: '1', title: 'Heat' },
        { id: '2', title: 'Zodiac' },
        { id: '3', title: 'Thief' },
      ],
    );
    expect(next).toEqual([
      { movieId: 1, title: 'Heat' },
      { movieId: 4, title: 'Manhunter' },
      { movieId: 3, title: 'Thief' },
    ]);
    expect(persistPicks).toHaveBeenCalledWith(next);
  });

  it('retries generation without saving feedback twice', async () => {
    const saveFeedback = vi.fn(async () => {});
    const onFeedbackSaved = vi.fn();
    const requestPicks = vi
      .fn<() => Promise<RawPick[]>>()
      .mockRejectedValueOnce(new Error('generation failed'))
      .mockResolvedValueOnce([{ title: 'Manhunter', id: '4' }]);
    const common = {
      slotId: 1 as const,
      picks,
      saveFeedback,
      onFeedbackSaved,
      readContext: async () => ({ profile: 'crime' }),
      requestPicks,
      hydratePick: async () => ({ movieId: 4, title: 'Manhunter' }),
      persistPicks: async () => {},
    };

    await expect(
      executeSelectReplacement({ ...common, feedbackSaved: false }),
    ).rejects.toThrow('generation failed');
    await expect(
      executeSelectReplacement({ ...common, feedbackSaved: true }),
    ).resolves.toEqual([
      { movieId: 1, title: 'Heat' },
      { movieId: 4, title: 'Manhunter' },
      { movieId: 3, title: 'Thief' },
    ]);

    expect(saveFeedback).toHaveBeenCalledTimes(1);
    expect(onFeedbackSaved).toHaveBeenCalledTimes(1);
    expect(requestPicks).toHaveBeenCalledTimes(2);
  });

  it('rejects a hydrated film that is not the recommended title', async () => {
    await expect(
      executeSelectReplacement<Pick, RawPick, Record<string, never>>({
        slotId: 1,
        picks,
        feedbackSaved: true,
        saveFeedback: async () => {},
        onFeedbackSaved: () => {},
        readContext: async () => ({}),
        requestPicks: async () => [{ title: 'Manhunter', id: '4' }],
        hydratePick: async () => ({ movieId: 99, title: 'Se7en' }),
        persistPicks: async () => {},
      }),
    ).rejects.toThrow('No new select available');
  });

  it('rejects a hydrated duplicate of any visible card', async () => {
    await expect(
      executeSelectReplacement<Pick, RawPick, Record<string, never>>({
        slotId: 1,
        picks,
        feedbackSaved: true,
        saveFeedback: async () => {},
        onFeedbackSaved: () => {},
        readContext: async () => ({}),
        requestPicks: async () => [{ title: 'HEAT', id: '1' }],
        hydratePick: async () => ({ movieId: 1, title: 'Heat' }),
        persistPicks: async () => {},
      }),
    ).rejects.toThrow('No new select available');
  });

  it('persists against live sibling slots and still excludes the departing title', async () => {
    const live: Pick[] = [
      { movieId: 4, title: 'Manhunter' },
      { movieId: 2, title: 'Zodiac' },
      { movieId: 3, title: 'Thief' },
    ];
    const persistPicks = vi.fn(async () => {});
    const requestPicks = vi.fn(async () => [{ title: 'Ronin', id: '5' }]);

    const next = await executeSelectReplacement<Pick, RawPick, Record<string, never>>({
      slotId: 2,
      picks,
      getPicks: () => live,
      feedbackSaved: true,
      saveFeedback: async () => {},
      onFeedbackSaved: () => {},
      readContext: async () => ({}),
      requestPicks,
      hydratePick: async () => ({ movieId: 5, title: 'Ronin' }),
      persistPicks,
    });

    expect(requestPicks).toHaveBeenCalledWith({}, [
      { id: '4', title: 'Manhunter' },
      { id: '2', title: 'Zodiac' },
      { id: '3', title: 'Thief' },
      { id: '1', title: 'Heat' },
    ]);
    expect(next).toEqual([
      { movieId: 4, title: 'Manhunter' },
      { movieId: 2, title: 'Zodiac' },
      { movieId: 5, title: 'Ronin' },
    ]);
    expect(persistPicks).toHaveBeenCalledWith(next);
  });

  it('rejects a candidate a sibling replacement already made visible', async () => {
    const live: Pick[] = [
      { movieId: 4, title: 'Manhunter' },
      { movieId: 2, title: 'Zodiac' },
      { movieId: 3, title: 'Thief' },
    ];

    await expect(
      executeSelectReplacement<Pick, RawPick, Record<string, never>>({
        slotId: 2,
        picks,
        getPicks: () => live,
        feedbackSaved: true,
        saveFeedback: async () => {},
        onFeedbackSaved: () => {},
        readContext: async () => ({}),
        requestPicks: async () => [{ title: 'Manhunter', id: '4' }],
        hydratePick: async () => ({ movieId: 4, title: 'Manhunter' }),
        persistPicks: async () => {},
      }),
    ).rejects.toThrow('No new select available');
  });

  it('tries the next candidate when persist reports a sibling collision', async () => {
    const persistPicks = vi
      .fn<(next: Pick[]) => Promise<boolean | void>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(undefined);

    const next = await executeSelectReplacement<Pick, RawPick, Record<string, never>>({
      slotId: 1,
      picks,
      feedbackSaved: true,
      saveFeedback: async () => {},
      onFeedbackSaved: () => {},
      readContext: async () => ({}),
      requestPicks: async () => [
        { title: 'Manhunter', id: '4' },
        { title: 'Ronin', id: '5' },
      ],
      hydratePick: async (raw) =>
        raw.title === 'Manhunter'
          ? { movieId: 4, title: 'Manhunter' }
          : { movieId: 5, title: 'Ronin' },
      persistPicks,
    });

    expect(next).toEqual([
      { movieId: 1, title: 'Heat' },
      { movieId: 5, title: 'Ronin' },
      { movieId: 3, title: 'Thief' },
    ]);
    expect(persistPicks).toHaveBeenCalledTimes(2);
  });

  it('lets two in-flight replacements persist without duplicating or clobbering', async () => {
    let live: Pick[] = [...picks];
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const run = (slotId: 0 | 2, film: Pick, raw: RawPick) =>
      executeSelectReplacement<Pick, RawPick, Record<string, never>>({
        slotId,
        picks,
        getPicks: () => live,
        feedbackSaved: true,
        saveFeedback: async () => {},
        onFeedbackSaved: () => {},
        readContext: async () => {
          await gate;
          return {};
        },
        requestPicks: async () => [raw],
        hydratePick: async () => film,
        persistPicks: async (updated) => {
          const incoming = updated[slotId];
          if (!incoming) return false;
          if (replacementConflictsWithSiblings(live, slotId, incoming)) return false;
          live = replacePickAtSlot(live, slotId, incoming);
        },
      });

    const first = run(0, { movieId: 4, title: 'Manhunter' }, { title: 'Manhunter', id: '4' });
    const second = run(2, { movieId: 5, title: 'Ronin' }, { title: 'Ronin', id: '5' });
    release();
    await Promise.all([first, second]);

    expect(live).toEqual([
      { movieId: 4, title: 'Manhunter' },
      { movieId: 2, title: 'Zodiac' },
      { movieId: 5, title: 'Ronin' },
    ]);
  });

  it('drops a colliding candidate when a sibling persist lands first', async () => {
    let live: Pick[] = [...picks];
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const run = (slotId: 0 | 2) =>
      executeSelectReplacement<Pick, RawPick, Record<string, never>>({
        slotId,
        picks,
        getPicks: () => live,
        feedbackSaved: true,
        saveFeedback: async () => {},
        onFeedbackSaved: () => {},
        readContext: async () => {
          await gate;
          return {};
        },
        requestPicks: async () => [{ title: 'Manhunter', id: '4' }],
        hydratePick: async () => ({ movieId: 4, title: 'Manhunter' }),
        persistPicks: async (updated) => {
          const incoming = updated[slotId];
          if (!incoming) return false;
          if (replacementConflictsWithSiblings(live, slotId, incoming)) return false;
          live = replacePickAtSlot(live, slotId, incoming);
        },
      });

    const first = run(0);
    const second = run(2);
    release();
    const results = await Promise.allSettled([first, second]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(live.filter((pick) => pick.title === 'Manhunter')).toHaveLength(1);
  });
});
