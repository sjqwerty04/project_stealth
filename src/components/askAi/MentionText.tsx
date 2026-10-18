import { splitMentions, type MentionEntity } from '../../lib/askAi/mentions';

const img = (path: string | null) => (path ? `https://image.tmdb.org/t/p/w92${path}` : null);

export function EntityThumb({ entity, size = 'sm' }: { entity: MentionEntity; size?: 'sm' | 'md' }) {
  const src = img(entity.image);
  const film = entity.kind === 'film';
  const box = film
    ? size === 'sm' ? 'w-[13px] h-[19px]' : 'w-[16px] h-[24px]'
    : size === 'sm' ? 'w-[16px] h-[16px]' : 'w-[20px] h-[20px]';
  return (
    <span
      className={`inline-block shrink-0 align-[-3px] overflow-hidden bg-base-3 border border-line ${box} ${film ? '' : 'rounded-full'}`}
      style={film ? { borderRadius: 'var(--radius-poster)' } : undefined}
      aria-hidden
    >
      {src && <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />}
    </span>
  );
}

type MentionTextProps = {
  text: string;
  entities: MentionEntity[];
  /** When set, entity names become buttons. Leave unset inside another button (starter chips). */
  onOpen?: (entity: MentionEntity) => void;
  size?: 'sm' | 'md';
};

// Text with a tiny poster (films) or avatar (people) inline before each name.
export default function MentionText({ text, entities, onOpen, size = 'sm' }: MentionTextProps) {
  return (
    <>
      {splitMentions(text, entities).map((seg, i) => {
        if (!('entity' in seg)) return <span key={i}>{seg.text}</span>;
        const inner = (
          <>
            <EntityThumb entity={seg.entity} size={size} />
            <span className={onOpen ? 'underline decoration-fg-3 underline-offset-2' : ''}>{seg.text}</span>
          </>
        );
        return onOpen ? (
          <button
            key={i}
            type="button"
            data-testid={`mention-${seg.entity.kind}`}
            data-entity-id={seg.entity.id}
            onClick={() => onOpen(seg.entity)}
            className="inline-flex items-baseline gap-1 text-fg hover:text-fg-2 font-medium"
          >
            {inner}
          </button>
        ) : (
          <span key={i} data-testid={`mention-${seg.entity.kind}`} className="inline-flex items-baseline gap-1">
            {inner}
          </span>
        );
      })}
    </>
  );
}
