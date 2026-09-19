import { useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Insight, SelectsProfile, TasteStats } from '../../lib/onboarding/profile';
import type { TasteGraph as TasteGraphModel } from '../../lib/onboarding/graph';
import ReadingDisc from '../../components/onboarding/ReadingDisc';
import TasteGraph from '../../components/onboarding/TasteGraph';
import { Label } from './StepFrame';

export function ReadingStep({
  count,
  sampled,
  total,
  colours,
}: {
  count: number;
  sampled: number;
  total: number;
  colours: string[];
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0 px-7" data-testid="reading-step">
      <Label>Reading</Label>
      <p className="font-display text-[44px] leading-none text-fg mt-1" data-testid="reading-count">
        {count}
      </p>
      <Label className="mt-1">Films read</Label>
      <div className="flex-1 flex items-center justify-center min-h-0 py-4">
        <ReadingDisc count={count} sampled={sampled} colours={colours} />
      </div>
      <p className="text-fg-2 text-sm leading-snug">
        Sampling every poster you have ever logged. This is the only screen allowed to look like it is thinking, because it is.
      </p>
      <Label className="mt-4 mb-2">
        Posters sampled · {sampled} / {total}
      </Label>
    </div>
  );
}

function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useCallback(() => {
    timer.current = setTimeout(onLongPress, ms);
  }, [onLongPress, ms]);
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  return { onPointerDown: start, onPointerUp: cancel, onPointerLeave: cancel, onPointerCancel: cancel };
}

async function shareText(text: string) {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard?.writeText(text);
  } catch {
    // The user dismissed the sheet or the platform refused. Nothing to recover.
  }
}

export function NegativeProfileStep({
  stats,
  profile,
  graph,
}: {
  stats: TasteStats;
  profile: SelectsProfile;
  graph: TasteGraphModel;
}) {
  const share = useCallback(
    () => shareText(`${profile.archetype ? profile.archetype + '. ' : ''}${profile.read} Your colour ${stats.colourHex.toUpperCase()}. Selects.`),
    [profile, stats.colourHex],
  );
  const press = useLongPress(share);
  return (
    <div className="flex-1 flex flex-col min-h-0 px-7 overflow-y-auto no-scrollbar">
      <Label>The negative</Label>
      <Label className="mt-1">
        {stats.filmsRead > 0
          ? `Struck from ${stats.filmsRead} films · It will change`
          : `Struck from ${stats.positive.length + stats.negative.length} picks · It will change`}
      </Label>
      <div className="flex-1 flex items-center justify-center min-h-0 py-2 select-none" {...press}>
        <TasteGraph graph={graph} accent={stats.colourHex} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {profile.archetype && (
          <motion.p
            key={profile.archetype}
            className="font-display text-[34px] leading-none tracking-tight"
            style={{ color: stats.colourHex }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            data-testid="profile-archetype"
          >
            {profile.archetype}
          </motion.p>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={profile.read}
          className="text-fg text-base leading-snug mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          data-testid="profile-read"
        >
          {profile.read}
        </motion.p>
      </AnimatePresence>
      <div className="mt-5 pt-4 border-t border-line flex items-center gap-3">
        <span className="inline-block w-4 h-4" style={{ background: stats.colourHex }} aria-hidden />
        <Label>Your colour</Label>
        <span className="font-spec text-xs text-fg" data-testid="profile-colour">
          {stats.colourHex.toUpperCase()}
        </span>
      </div>
      <Label className="mt-2">Oklab average of {stats.postersSampled} posters</Label>
      <Label className="mt-1 mb-2">Long-press to share</Label>
    </div>
  );
}

function InsightCard({ card, index }: { card: Insight; index: number }) {
  const press = useLongPress(() => shareText(`${card.title}. ${card.headline} ${card.body} Selects.`));
  const sharp = card.tone === 'sharp';
  return (
    <motion.article
      data-testid="insight-card"
      data-tone={card.tone}
      className={`border p-5 select-none ${sharp ? 'border-select' : 'border-line'} bg-base-2`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 * index, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      {...press}
    >
      <Label accent={sharp}>{card.title}</Label>
      <p className={`font-display text-fg mt-2 leading-tight ${card.headline.length <= 6 ? 'text-[40px]' : 'text-lg'}`}>{card.headline}</p>
      <p className="text-fg-2 text-sm mt-2 leading-snug">{card.body}</p>
    </motion.article>
  );
}

export function InsightsStep({ profile }: { profile: SelectsProfile }) {
  return (
    <div className="flex-1 flex flex-col min-h-0 px-7">
      <div className="flex items-center gap-3">
        <Label>Insights · {profile.insights.length} reads</Label>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 mt-4 flex flex-col gap-3 pb-4">
        {profile.insights.map((card, i) => (
          <InsightCard key={card.title + i} card={card} index={i} />
        ))}
        <Label className="mt-2">Eight warm, two sharp.</Label>
        <Label>Long-press any card to share it</Label>
      </div>
    </div>
  );
}
