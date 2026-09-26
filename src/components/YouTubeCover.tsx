import { forwardRef, useEffect, useRef } from 'react';

type Props = {
  videoId: string;
  title?: string;
  testId?: string;
};

/**
 * YouTube draws its title, logo, and end card inside the iframe. The parent page
 * cannot style that document, and the old modestbranding flags no longer remove it.
 * Scale the player past the frame so that chrome sits outside the clip, and seek
 * back to the start before the end card.
 */
const YouTubeCover = forwardRef<HTMLIFrameElement, Props>(function YouTubeCover({ videoId, title = '', testId }, ref) {
  const localRef = useRef<HTMLIFrameElement>(null);
  const setRef = (node: HTMLIFrameElement | null) => {
    localRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  useEffect(() => {
    const iframe = localRef.current;
    if (!iframe) return;
    const send = (func: string, args: unknown[] = []) => {
      iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
    };
    const listen = () => {
      iframe.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: videoId }), '*');
      send('addEventListener', ['onStateChange']);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      let data: { event?: string; info?: { currentTime?: number; duration?: number; playerState?: number } } | null = null;
      if (typeof event.data === 'string') {
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
      } else if (event.data && typeof event.data === 'object') {
        data = event.data;
      }
      const info = data?.info;
      const duration = info?.duration ?? 0;
      const current = info?.currentTime ?? 0;
      if (duration > 2 && current > 1 && duration - current < 1.4) send('seekTo', [0, true]);
      if (info?.playerState === 0) send('seekTo', [0, true]);
    };
    iframe.addEventListener('load', listen);
    window.addEventListener('message', onMessage);
    return () => {
      iframe.removeEventListener('load', listen);
      window.removeEventListener('message', onMessage);
    };
  }, [videoId]);

  const src =
    `https://www.youtube-nocookie.com/embed/${videoId}` +
    `?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}` +
    `&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&cc_load_policy=0&enablejsapi=1`;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" data-testid={testId}>
      <iframe
        ref={setRef}
        title={title}
        src={src}
        allow="autoplay; encrypted-media"
        data-clip-key={videoId}
        className="absolute left-1/2 top-1/2 border-0 pointer-events-none"
        style={{
          width: '100%',
          height: '100%',
          transform: 'translate(-50%, -50%) scale(1.9)',
        }}
      />
    </div>
  );
});

export default YouTubeCover;
