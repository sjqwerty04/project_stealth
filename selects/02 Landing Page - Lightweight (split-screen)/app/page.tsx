"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { FilmRings } from "@/components/FilmRings";
import { DottedCanvas } from "@/components/DottedCanvas";
import { SelectsOrbit } from "@/components/SelectsOrbit";

type PanelState = "split" | "selects" | "premise";

const PREMISE_URL = "http://localhost:3100";

export default function Home() {
  const [panel, setPanel] = useState<PanelState>("split");
  const [showIframe, setShowIframe] = useState(false);
  const [ringPos, setRingPos] = useState({ rx: 0.5, ry: 0.5 });
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistDone, setWaitlistDone] = useState(false);
  const selectsPanelRef = useRef<HTMLDivElement>(null);
  const iframeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSelectsMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = selectsPanelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setRingPos({
      rx: (e.clientX - rect.left) / rect.width,
      ry: (e.clientY - rect.top) / rect.height,
    });
  }, []);

  const open = (target: PanelState) => {
    if (panel !== "split") return;
    setPanel(target);
    if (target === "premise") {
      iframeTimerRef.current = setTimeout(() => setShowIframe(true), 950);
    }
  };

  const back = () => {
    setPanel("split");
    setShowIframe(false);
    if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current);
  };

  useEffect(() => () => {
    if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current);
  }, []);

  const isExpanded = panel !== "split";
  const splitClass = panel === "selects" ? "selects-open" : panel === "premise" ? "premise-open" : "";

  return (
    <div className="root">
      <div className={`name-header${isExpanded ? " hidden" : ""}`}>
        <h1>Shiv Jethi</h1>
      </div>

      <div className={`split${splitClass ? ` ${splitClass}` : ""}`}>

        {/* ── SELECTS panel ─────────────────────────────────────────────── */}
        <div
          ref={selectsPanelRef}
          className="panel panel-selects"
          onClick={() => open("selects")}
          onMouseMove={onSelectsMouseMove}
        >
          <div className="rings-wrap">
            <FilmRings rx={ringPos.rx} ry={ringPos.ry} />
          </div>

          {/* Logo — correct film aperture design, animates center → top-left */}
          <div className="selects-wordmark">
            <svg className="selects-icon" viewBox="0 0 68 48" fill="none">
              {/* outer film strip frame */}
              <rect x="1" y="1" width="66" height="46" rx="1.5" stroke="white" strokeWidth="1.5"/>
              {/* left sprocket bars — top + bottom */}
              <rect x="1"  y="10"   width="13" height="3" fill="white"/>
              <rect x="1"  y="35"   width="13" height="3" fill="white"/>
              {/* right sprocket bars — top + bottom */}
              <rect x="54" y="10"   width="13" height="3" fill="white"/>
              <rect x="54" y="35"   width="13" height="3" fill="white"/>
              {/* inner aperture gate */}
              <rect x="15" y="5" width="38" height="38" rx="2.5" fill="white"/>
            </svg>
            <span className="selects-text">SELECTS</span>
          </div>

          {/* Expanded content */}
          <div className="expanded-content sel-expanded" onClick={(e) => e.stopPropagation()}>

            {/* 1 — 3D orbit hero */}
            <div className="sel-orbit-wrap">
              <SelectsOrbit />
            </div>

            {/* 2 — Tagline */}
            <div className="sel-copy">
              <h2 className="sel-h1">The algorithm never knew you.</h2>
              <h2 className="sel-h2">Selects does.</h2>

              {/* 3 — Inline stats */}
              <div className="sel-stats">
                <span><strong>49%</strong> of viewers give up and watch nothing</span>
                <span className="sel-dot" aria-hidden>·</span>
                <span><strong>110 hrs</strong> a year spent deciding, not watching</span>
                <span className="sel-dot" aria-hidden>·</span>
                <span><strong>481 of 9,000</strong> films on the top platform rated above 7.5</span>
              </div>

              {/* 4 — One sentence */}
              <p className="sel-desc">
                Selects learns what connects every film you love —
                then finds the next one you&apos;ll never forget.
              </p>

              {/* 5 — Waitlist CTA */}
              {waitlistDone ? (
                <div className="sel-success">
                  <p className="sel-success-main">You&apos;re on the list.</p>
                  <p className="sel-success-sub">Tonight&apos;s still on you. The next one is on us.</p>
                </div>
              ) : (
                <form
                  className="sel-cta-row"
                  onSubmit={(e) => { e.preventDefault(); if (waitlistEmail.trim()) setWaitlistDone(true); }}
                >
                  <input
                    type="email"
                    className="sel-email"
                    placeholder="your@email.com"
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    required
                  />
                  <button type="submit" className="sel-cta-btn">Get early access →</button>
                </form>
              )}
              <p className="sel-cta-note">No algorithm. No agenda. No noise.</p>
            </div>
          </div>

          <span className="panel-hint">Click to explore</span>
        </div>

        {/* ── PREMISE panel ─────────────────────────────────────────────── */}
        <div
          className="panel panel-premise"
          onClick={() => open("premise")}
        >
          <div className="dots-wrap">
            <DottedCanvas />
          </div>

          <div className={`premise-wordmark${showIframe ? " wordmark-hidden" : ""}`}>
            <span className="premise-wordmark-text">
              premise<span className="premise-wordmark-dot">.</span>
            </span>
          </div>

          {showIframe && (
            <iframe
              src={PREMISE_URL}
              className="premise-iframe"
              title="Premise"
              allow="microphone"
            />
          )}

          <span className="panel-hint">Click to explore</span>
        </div>

      </div>

      <button
        className={`back-btn${isExpanded ? " visible" : ""}`}
        onClick={back}
        aria-label="Back to home"
      >
        ← Back
      </button>
    </div>
  );
}
