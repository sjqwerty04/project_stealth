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

  it('matches diary titles named in whyMatch, longer first, cap 2', () => {
    expect(
      relatedFromWhy(
        "You rated Se7en a 5 and logged All the President's Men last month.",
        diary,
        'Zodiac',
      ),
    ).toEqual([
      { title: "All the President's Men", poster: 'atpm.jpg' },
      { title: 'Se7en', poster: 'se7en.jpg' },
    ]);
  });

  it('excludes the current film title', () => {
    expect(
      relatedFromWhy('You logged Heat after Thief.', [...diary, { title: 'Thief', poster: 'thief.jpg' }], 'Heat'),
    ).toEqual([{ title: 'Thief', poster: 'thief.jpg' }]);
  });

  it('does not let a short title steal a longer match', () => {
    expect(
      relatedFromWhy("All the President's Men is the template.", diary, 'Zodiac'),
    ).toEqual([{ title: "All the President's Men", poster: 'atpm.jpg' }]);
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

    expect(html).toContain('Watched');
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

  it('keeps Watched enabled after a failed replacement', () => {
    const failed = {
      slotId: 1 as const,
      phase: 'failed' as const,
      feedbackSaved: true as const,
      message: 'Could not find another select',
    };
    const failedSlot = renderToString(
      React.createElement(SelectCard, {
        film,
        pickerOpen: false,
        replacement: failed,
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
        pickerOpen: true,
        replacement: failed,
        onOpenMovie: () => {},
        onOpenPicker: () => {},
        onClosePicker: () => {},
        onVerdict: () => {},
        onRetry: () => {},
      }),
    );
    const busy = renderToString(
      React.createElement(SelectCard, {
        film,
        pickerOpen: false,
        replacement: { slotId: 1, phase: 'saving', feedbackSaved: false },
        onOpenMovie: () => {},
        onOpenPicker: () => {},
        onClosePicker: () => {},
        onVerdict: () => {},
        onRetry: () => {},
      }),
    );

    expect(failedSlot).not.toMatch(/data-testid="watched-1"[^>]*\sdisabled[\s=>]/);
    expect(sibling).not.toMatch(/data-testid="watched-0"[^>]*\sdisabled[\s=>]/);
    expect(sibling).not.toMatch(/data-testid="verdict-liked"[^>]*\sdisabled[\s=>]/);
    expect(busy).toMatch(/data-testid="watched-1"[^>]*\sdisabled[\s=>]/);
  });
});
