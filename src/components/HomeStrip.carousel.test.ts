import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { SelectCard } from './SelectsCarousel';
import {
  loopingSlides,
  relatedFromWhy,
  relatedPosterPool,
  SELECTS_AUTOPLAY_MS,
  SELECTS_TRANSITION_MS,
  carouselArtIdsStillNeeded,
  slideIdentityKey,
  snapLoopIndex,
} from './selectsCarouselLogic';

describe('related poster pool', () => {
  it('finds a film rated from Selects, which has a ledger poster but no logged night', () => {
    const nights = [{ title: 'The Dark Knight', poster: 'tdk.jpg' }];
    const ledger = [
      { title: 'The Dark Knight', poster: 'tdk.jpg' },
      { title: 'The Prestige', poster: 'prestige.jpg' },
    ];

    const pool = relatedPosterPool(nights, ledger);
    expect(pool).toEqual([
      { title: 'The Dark Knight', poster: 'tdk.jpg' },
      { title: 'The Prestige', poster: 'prestige.jpg' },
    ]);

    expect(
      relatedFromWhy(
        'The Prestige and The Dark Knight already proved you want story architecture, and Inception is built the same way.',
        pool,
        'Inception',
      ),
    ).toEqual([
      { title: 'The Prestige', poster: 'prestige.jpg' },
      { title: 'The Dark Knight', poster: 'tdk.jpg' },
    ]);
  });

  it('drops ledger films with no poster and prefers the logged night', () => {
    const pool = relatedPosterPool(
      [{ title: 'Heat', poster: 'night.jpg' }],
      [{ title: 'heat', poster: 'ledger.jpg' }, { title: 'Thief', poster: '' }],
    );
    expect(pool).toEqual([{ title: 'Heat', poster: 'night.jpg' }]);
  });
});

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

  it('fetches art only for slides that do not have it yet', () => {
    expect(carouselArtIdsStillNeeded([155, 949], [155, 949, 599])).toEqual([599]);
    expect(carouselArtIdsStillNeeded([], [155, 949])).toEqual([155, 949]);
    expect(carouselArtIdsStillNeeded([155, 155], [155])).toEqual([]);
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

  const WIND_RIVER_WHY =
    'If Sicario and Hell or High Water already clicked, Wind River is the next Taylor Sheridan crime procedural. Wind River sends a tracker and an FBI agent into a frozen reservation murder case that never lets the tension thaw. It is grim, methodical, and built for viewers who like moral gray zones more than easy wins.';
  const DONNIE_WHY =
    'The Departed and The Town make Donnie Brasco a strong undercover companion piece. Donnie Brasco follows an FBI agent who lives so deep with the mob that friendship and duty start to tear him apart. The street-level loyalty tests fit the crime dramas you already finish at 6.';

  it('resolves Sicario and Hell or High Water from library rows with posters', () => {
    expect(
      relatedFromWhy(
        WIND_RIVER_WHY,
        [
          { title: 'Sicario', poster: 'sicario.jpg' },
          { title: 'Hell or High Water', poster: 'hohw.jpg' },
        ],
        'Wind River',
      ),
    ).toEqual([
      { title: 'Sicario', poster: 'sicario.jpg' },
      { title: 'Hell or High Water', poster: 'hohw.jpg' },
    ]);
  });

  it('shows no chips when named films have empty posters, not a stand-in', () => {
    expect(
      relatedFromWhy(
        WIND_RIVER_WHY,
        [
          { title: 'Sicario', poster: '' },
          { title: 'Hell or High Water' },
          { title: 'The King', poster: 'king.jpg' },
        ],
        'Wind River',
      ),
    ).toEqual([]);
  });

  it('shows Departed and Town, never The King', () => {
    expect(
      relatedFromWhy(
        DONNIE_WHY,
        [
          { title: 'The Departed', poster: 'departed.jpg' },
          { title: 'The Town', poster: 'town.jpg' },
          { title: 'The King', poster: 'king.jpg' },
        ],
        'Donnie Brasco',
      ),
    ).toEqual([
      { title: 'The Departed', poster: 'departed.jpg' },
      { title: 'The Town', poster: 'town.jpg' },
    ]);
  });

  it('does not use The King when Departed and Town have no posters', () => {
    expect(
      relatedFromWhy(
        DONNIE_WHY,
        [
          { title: 'The Departed' },
          { title: 'The Town', poster: '' },
          { title: 'The King', poster: 'king.jpg' },
          { title: 'The King: Eternal Monarch', poster: 'monarch.jpg' },
        ],
        'Donnie Brasco',
      ),
    ).toEqual([]);
  });

  it('resolves copy that drops The to the official diary title', () => {
    expect(
      relatedFromWhy(
        'Departed and Town make Donnie Brasco a strong undercover companion piece.',
        [
          { title: 'The Departed', poster: 'departed.jpg' },
          { title: 'The Town', poster: 'town.jpg' },
          { title: 'The King', poster: 'king.jpg' },
        ],
        'Donnie Brasco',
      ),
    ).toEqual([
      { title: 'The Departed', poster: 'departed.jpg' },
      { title: 'The Town', poster: 'town.jpg' },
    ]);
  });

  it('ignores history names after the first sentence', () => {
    expect(
      relatedFromWhy(
        'Wind River is grim, methodical, and built for viewers who like moral gray zones. Sicario and Hell or High Water already clicked.',
        [
          { title: 'Sicario', poster: 'sicario.jpg' },
          { title: 'Hell or High Water', poster: 'hohw.jpg' },
        ],
        'Wind River',
      ),
    ).toEqual([]);
  });

  it('finds diary titles after honorifics and initials in the first sentence', () => {
    expect(
      relatedFromWhy(
        'If Dr. No and L.A. Confidential already clicked, Heat is next. Ignore Se7en here.',
        [
          { title: 'Dr. No', poster: 'drno.jpg' },
          { title: 'L.A. Confidential', poster: 'la.jpg' },
          { title: 'Se7en', poster: 'se7en.jpg' },
        ],
        'Heat',
      ),
    ).toEqual([
      { title: 'Dr. No', poster: 'drno.jpg' },
      { title: 'L.A. Confidential', poster: 'la.jpg' },
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
