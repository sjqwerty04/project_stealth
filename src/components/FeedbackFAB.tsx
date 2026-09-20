import { useState } from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import FeedbackModal from './FeedbackModal';

/**
 * `inline` sits in a screen's own header. `floating` pins to the tab bar, which
 * only works on screens that scroll the document rather than a column of their own.
 */
export default function FeedbackFAB({ variant = 'floating' }: { variant?: 'floating' | 'inline' }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const floating = variant === 'floating';

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={
          floating
            ? 'fixed right-4 z-40 w-11 h-11 bg-base-3 border border-line text-fg flex items-center justify-center'
            : 'w-11 h-11 shrink-0 bg-base-3 border border-line text-fg flex items-center justify-center'
        }
        style={{
          ...(floating
            ? { bottom: 'calc(var(--tab-h) + env(safe-area-inset-bottom) + 12px)' }
            : {}),
          borderRadius: 0,
        }}
        title="Send Feedback"
        aria-label="Send feedback"
      >
        <MessageCircleQuestion size={24} />
      </button>

      <FeedbackModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
}
