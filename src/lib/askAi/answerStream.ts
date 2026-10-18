import { noEmDash } from './starters.js';

export const ENTITY_SENTINEL = '<<ENTITIES>>';

export type RawEntities = { films?: { title: string; year?: string }[]; people?: string[] };

/**
 * Turns raw model deltas into text that is safe to show while streaming: em dashes
 * are rewritten, and the trailing entity block after the sentinel is never shown.
 * Holds back trailing whitespace and anything that could be the start of the
 * sentinel, so what was already sent never has to be taken back.
 */
export function createAnswerStream() {
  let raw = '';
  let sent = '';

  const visible = () => {
    const cut = raw.indexOf(ENTITY_SENTINEL);
    if (cut >= 0) return raw.slice(0, cut);
    for (let n = Math.min(ENTITY_SENTINEL.length - 1, raw.length); n > 0; n--) {
      if (ENTITY_SENTINEL.startsWith(raw.slice(-n))) return raw.slice(0, -n);
    }
    return raw;
  };

  return {
    push(delta: string): string {
      raw += delta;
      const next = noEmDash(visible()).trimEnd();
      if (!next.startsWith(sent)) return '';
      const out = next.slice(sent.length);
      sent = next;
      return out;
    },
    finish(): { text: string; entities: RawEntities } {
      const cut = raw.indexOf(ENTITY_SENTINEL);
      const text = noEmDash((cut >= 0 ? raw.slice(0, cut) : raw).trim());
      let entities: RawEntities = {};
      if (cut >= 0) {
        const block = raw.slice(cut + ENTITY_SENTINEL.length).replace(/```(?:json)?/g, '').trim();
        try {
          entities = JSON.parse(block.slice(block.indexOf('{'), block.lastIndexOf('}') + 1));
        } catch {
          entities = {};
        }
      }
      return { text, entities };
    },
  };
}
