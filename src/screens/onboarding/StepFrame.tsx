import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../components/ui';

const STEP_ENTER = { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

export function Label({ children, accent = false, className = '' }: { children: ReactNode; accent?: boolean; className?: string }) {
  return (
    <p className={`font-spec text-[10px] uppercase tracking-widest ${accent ? 'text-select' : 'text-fg-3'} ${className}`}>{children}</p>
  );
}

export function Question({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-[22px] leading-[1.15] text-fg mt-2">{children}</h2>;
}

/** One screen body. Enters from below, leaves upward, so consecutive steps read as one sheet sliding. */
export function StepBody({ testId, children, className = '' }: { testId: string; children: ReactNode; className?: string }) {
  return (
    <motion.div
      data-testid={testId}
      className={`flex-1 flex flex-col min-h-0 ${className}`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16, transition: { duration: 0.3 } }}
      transition={STEP_ENTER}
    >
      {children}
    </motion.div>
  );
}

export function Cta({
  label,
  onPress,
  disabled,
  loading,
  secondary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  secondary?: { label: string; onPress: () => void; testId?: string };
}) {
  return (
    <div className="px-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 flex flex-col items-center gap-3 bg-base">
      {secondary && (
        <button
          type="button"
          onClick={secondary.onPress}
          className="min-h-11 font-spec text-[10px] uppercase tracking-widest text-fg-3"
          data-testid={secondary.testId ?? 'onboarding-skip'}
        >
          {secondary.label}
        </button>
      )}
      <Button className="w-full" onClick={onPress} disabled={disabled} loading={loading} data-testid="onboarding-cta">
        {label}
      </Button>
    </div>
  );
}
