import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircleQuestion } from 'lucide-react';
import FeedbackModal from './FeedbackModal';

export default function FeedbackFAB() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { pathname } = useLocation();
  const aboveStrip = pathname === '/app';

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed right-4 z-40 w-11 h-11 bg-base-3 border border-line text-fg flex items-center justify-center"
        style={{
          bottom: aboveStrip
            ? 'calc(var(--tab-h) + env(safe-area-inset-bottom) + 348px)'
            : 'calc(var(--tab-h) + env(safe-area-inset-bottom) + 12px)',
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

