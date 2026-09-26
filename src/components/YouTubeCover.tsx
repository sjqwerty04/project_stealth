import { forwardRef, useEffect, useRef } from 'react';

type Props = {
  videoId: string;
  title?: string;
  testId?: string;
  poster?: string | null;
};

type YTPlayer = {
  mute: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getIframe: () => HTMLIFrameElement;
  destroy: () => void;
};

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement | string, opts: Record<string, unknown>) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiReady: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (!apiReady) {
    apiReady = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve();
      };
      if (!document.querySelector('script[data-youtube-iframe-api]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.dataset.youtubeIframeApi = '1';
        document.head.appendChild(script);
      }
    });
  }
  return apiReady;
}

/** Zoom past the title bar, the corner mark, and "Watch on YouTube". They sit inside the iframe. */
const CROP = 'translate(-50%, -50%) scale(2.4)';

function cropIframe(iframe: HTMLIFrameElement) {
  iframe.style.position = 'absolute';
  iframe.style.left = '50%';
  iframe.style.top = '50%';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.transform = CROP;
  iframe.style.border = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.opacity = '0';
}

/**
 * YouTube's poster is the frame people see: title, play button, logo, "Watch on YouTube".
 * Keep the film still over the iframe until the player reports it is actually playing,
 * then reveal the cropped video and restart before the end card.
 */
const YouTubeCover = forwardRef<HTMLIFrameElement, Props>(function YouTubeCover(
  { videoId, title = '', testId, poster },
  ref,
) {
  const mountRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLImageElement>(null);
  const setRef = (node: HTMLIFrameElement | null) => {
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let player: YTPlayer | null = null;
    let timer = 0;
    let cancelled = false;

    loadYouTubeApi().then(() => {
      if (cancelled || !mountRef.current || !window.YT?.Player) return;
      player = new window.YT.Player(mountRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          loop: 1,
          playlist: videoId,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0,
          cc_load_policy: 0,
          enablejsapi: 1,
        },
        events: {
          onReady: (event: { target: YTPlayer }) => {
            const iframe = event.target.getIframe();
            iframe.title = title;
            cropIframe(iframe);
            setRef(iframe);
            event.target.mute();
            event.target.playVideo();
            timer = window.setInterval(() => {
              const state = event.target.getPlayerState();
              const duration = event.target.getDuration();
              const current = event.target.getCurrentTime();
              const playing = state === 1 && current > 0.2;
              iframe.style.opacity = playing ? '1' : '0';
              if (posterRef.current) posterRef.current.style.opacity = playing ? '0' : '1';
              if (!playing) {
                event.target.mute();
                event.target.playVideo();
              }
              if (duration > 2 && current > 1 && duration - current < 2) event.target.seekTo(0, true);
            }, 400);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      setRef(null);
      player?.destroy();
    };
  }, [videoId, title]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none bg-black" data-testid={testId}>
      <div ref={mountRef} className="absolute inset-0" />
      {poster ? (
        <img
          ref={posterRef}
          src={poster}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </div>
  );
});

export default YouTubeCover;
