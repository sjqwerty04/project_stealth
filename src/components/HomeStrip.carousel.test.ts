import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { SelectCard } from './SelectsCarousel';
import {
  loopingSlides,
  relatedFromWhy,
  SELECTS_AUTOPLAY_MS,
  SELECTS_TRANSITION_MS,
  slideIdentityKey,
  snapLoopIndex,
} from './selectsCarouselLogic';

describe('selects carousel loop', () => {
  const slides = [{ id: 1 }, { id: 2 }, { id: 3 }];

  it('clones last and first so wrap can animate sideways', () => {
    expect(loopingSlides(slides).map((s) => s.id)).toEqual([3, 1, 2, 3, 1]);
  });

  it('snaps clone of last (index 0) to the real last slide', () => {
    expect(snapLoopIndex(0, 3)).toBe(3);
  });

  it('snaps clone of first (index 4) to the real first slide', () => {
    expect(snapLoopIndex(4, 3)).toBe(1);
  });

  it('leaves in-range indices alone', () => {
    expect(snapLoopIndex(1, 3)).toBeNull();
    expect(snapLoopIndex(3, 3)).toBeNull();
  });

  it('holds 6.2s and eases 900ms', () => {
    expect(SELECTS_AUTOPLAY_MS).toBe(6200);
    expect(SELECTS_TRANSITION_MS).toBe(900);
  });

  it('keeps carousel identity when a movie changes in one slot', () => {
    expect(
      slideIdentityKey([
        { slotId: 0, id: 1 },
        { slotId: 1, id: 2 },
        { slotId: 2, id: 3 },
      ]),
    ).toBe(
      slideIdentityKey([
        { slotId: 0, id: 1 },
        { slotId: 1, id: 99 },
        { slotId: 2, id: 3 },
      ]),
    );
  });
});

describe('relatedFromWhy', () => {
  const diary = [
    { title: 'Heat', poster: 'heat.jpg' },
    { title: "All the President's Men", poster: 'atpm.jpg' },
    { title: 'Se7en', poster: 'se7en.jpg' },
    { title: 'The', poster: 'the.jpg' },
  ];

  it('matches diary titles named in whyMatch, mention order, cap 2', () => {
    expect(
      relatedFromWhy(
        "You rated Se7en a 5 and logged All the President's Men last month.",
        diary,
        'Zodiac',
      ),
    ).toEqual([
      { title: 'Se7en', poster: 'se7en.jpg' },
      { title: "All the President's Men", poster: 'atpm.jpg' },
    ]);
  });

  it('excludes the current film title', () => {
    expect(
      relatedFromWhy('You logged Heat after Thief.', [...diary, { title: 'Thief', poster: 'thief.jpg' }], 'Heat'),
    ).toEqual([{ title: 'Thief', poster: 'thief.jpg' }]);
  });

  it('carries diary movie ids so related posters can open detail', () => {
    expect(
      relatedFromWhy(
        'You logged Heat after Thief.',
        [
          { title: 'Heat', poster: 'heat.jpg', movieId: 670 },
          { title: 'Thief', poster: 'thief.jpg', movieId: 11373, mediaType: 'movie' },
        ],
        'Heat',
      ),
    ).toEqual([{ title: 'Thief', poster: 'thief.jpg', movieId: 11373, mediaType: 'movie' }]);
  });

  it('does not let a short title steal a longer match', () => {
    expect(
      relatedFromWhy("All the President's Men is the template.", diary, 'Zodiac'),
    ).toEqual([{ title: "All the President's Men", poster: 'atpm.jpg' }]);
  });

  it('uses the first named diary films for Logan, including X2', () => {
    const loganDiary = [
      { title: 'Cape Fear', poster: 'cape-fear.jpg' },
      { title: 'Sleepers', poster: 'sleepers.jpg' },
      { title: 'There Will Be Blood', poster: 'twbb.jpg' },
      { title: 'X-Men', poster: 'xmen.jpg' },
      { title: 'X2', poster: 'x2.jpg' },
    ];
    expect(
      relatedFromWhy(
        'X-Men and X2 both got a 5 from you, and Logan is the scarred, adult finish of that world. It has the bruised father and child tension you already rewarded in Cape Fear and Sleepers. The western grit should land if you also wanted something like There Will Be Blood.',
        loganDiary,
        'Logan',
      ),
    ).toEqual([
      { title: 'X-Men', poster: 'xmen.jpg' },
      { title: 'X2', poster: 'x2.jpg' },
    ]);
  });

  it('resolves short why names to official diary titles on every slide', () => {
    const diary = [
      { title: 'Cape Fear', poster: 'cape-fear.jpg' },
      { title: 'Sleepers', poster: 'sleepers.jpg' },
      { title: 'There Will Be Blood', poster: 'twbb.jpg' },
      { title: 'X-Men: The Last Stand', poster: 'xls.jpg' },
      { title: 'X2: X-Men United', poster: 'x2u.jpg' },
      { title: 'Se7en', poster: 'se7en.jpg' },
      { title: "All the President's Men", poster: 'atpm.jpg' },
      { title: 'Infernal Affairs', poster: 'ia.jpg' },
      { title: 'The Godfather', poster: 'gf.jpg' },
      { title: 'Thief', poster: 'thief.jpg' },
      { title: 'Collateral', poster: 'collateral.jpg' },
    ];

    expect(
      relatedFromWhy(
        'X-Men and X2 both got a 5 from you, and Logan is the scarred, adult finish of that world. It has the bruised father and child tension you already rewarded in Cape Fear and Sleepers.',
        diary,
        'Logan',
      ),
    ).toEqual([
      { title: 'X-Men: The Last Stand', poster: 'xls.jpg' },
      { title: 'X2: X-Men United', poster: 'x2u.jpg' },
    ]);

    expect(
      relatedFromWhy(
        "You rated Se7en a 5 and logged All the President's Men last month. Fincher's procedural patience is the same itch.",
        diary,
        'Zodiac',
      ),
    ).toEqual([
      { title: 'Se7en', poster: 'se7en.jpg' },
      { title: "All the President's Men", poster: 'atpm.jpg' },
    ]);

    expect(
      relatedFromWhy(
        'You keep coming back to Infernal Affairs and The Godfather. Scorsese Boston crime web has the same loyalty-as-trap energy you already marked as a 5.',
        diary,
        'The Departed',
      ),
    ).toEqual([
      { title: 'Infernal Affairs', poster: 'ia.jpg' },
      { title: 'The Godfather', poster: 'gf.jpg' },
    ]);
  });

  it('prefers an exact diary title over a sequel that shares the same prefix', () => {
    expect(
      relatedFromWhy(
        'X-Men and X2 both got a 5 from you.',
        [
          { title: 'X-Men: The Last Stand', poster: 'xls.jpg' },
          { title: 'X-Men', poster: 'xmen.jpg' },
          { title: 'X2: X-Men United', poster: 'x2u.jpg' },
          { title: 'Cape Fear', poster: 'cape-fear.jpg' },
        ],
        'Logan',
      ),
    ).toEqual([
      { title: 'X-Men', poster: 'xmen.jpg' },
      { title: 'X2: X-Men United', poster: 'x2u.jpg' },
    ]);
  });
});

describe('select card watched control', () => {
  const film = {
    slotId: 1 as const,
    id: 2,
    title: 'Zodiac',
    poster: 'zodiac.jpg',
  };

  it("uses the diary verdict labels in the Watched picker", () => {
    const html = renderToString(
      React.createElement(SelectCard, {
        film,
        pickerOpen: true,
        replacement: null,
        onOpenMovie: () => {},
        onOpenPicker: () => {},
        onClosePicker: () => {},
        onVerdict: () => {},
        onRetry: () => {},
      }),
    );

    expect(html).toContain('Watched?');
    expect(html).toContain('select-open-movie');
    expect(html).toContain('Liked');
    expect(html).toContain("It&#x27;s okay");
    expect(html).toContain('Nope');
  });

  it('shows loading only in the affected slot and keeps its title', () => {
    const affected = renderToString(
      React.createElement(SelectCard, {
        film,
        pickerOpen: false,
        replacement: { slotId: 1, phase: 'replacing', feedbackSaved: true },
        onOpenMovie: () => {},
        onOpenPicker: () => {},
        onClosePicker: () => {},
        onVerdict: () => {},
        onRetry: () => {},
      }),
    );
    const sibling = renderToString(
      React.createElement(SelectCard, {
        film: { ...film, slotId: 0, id: 1, title: 'Heat' },
        pickerOpen: false,
        replacement: { slotId: 1, phase: 'replacing', feedbackSaved: true },
        onOpenMovie: () => {},
        onOpenPicker: () => {},
        onClosePicker: () => {},
        onVerdict: () => {},
        onRetry: () => {},
      }),
    );

    expect(affected).toContain('Finding another select');
    expect(affected).toContain('aria-label="Zodiac"');
    expect(sibling).toContain('aria-label="Heat"');
    expect(sibling).not.toContain('Finding another select');
    expect(sibling).not.toMatch(/data-testid="watched-0"[^>]*\sdisabled=/);
    expect(affected).toMatch(/data-testid="watched-1"[^>]*\sdisabled=/);
  });

  it('shows retry only on the failed slot', () => {
    const html = renderToString(
      React.createElement(SelectCard, {
        film,
        pickerOpen: false,
        replacement: {
          slotId: 1,
          phase: 'failed',
          feedbackSaved: true,
          message: 'Could not find another select',
        },
        onOpenMovie: () => {},
        onOpenPicker: () => {},
        onClosePicker: () => {},
        onVerdict: () => {},
        onRetry: () => {},
      }),
    );

    expect(html).toContain('Could not find another select');
    expect(html).toContain('Retry');
  });
});
