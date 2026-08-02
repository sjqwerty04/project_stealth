"use client";

import { useRef, useCallback } from "react";
import HeroSection from "@/components/Hero/HeroSection";
import StatsBand from "@/components/StatsBand/StatsBand";
import FilmStripScroll from "@/components/FilmStrip/FilmStripScroll";
import FiveTiers from "@/components/FiveTiers/FiveTiers";
import ProcessCard from "@/components/ProcessCard/ProcessCard";
import DiscoverCards from "@/components/DiscoverCards/DiscoverCards";
import OriginStory from "@/components/FilmStrip/OriginStory";
import SoulCTA from "@/components/Soul/SoulCTA";
import OnboardingFlow from "@/components/Onboarding/OnboardingFlow";
import Footer from "@/components/Footer";

export default function Home() {
  const onboardingRef = useRef<HTMLDivElement>(null);

  const scrollToOnboarding = useCallback(() => {
    onboardingRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <main className="relative">
      {/* Section 1: Hero — IMAX glass ring film reels */}
      <HeroSection onCTAClick={scrollToOnboarding} />

      {/* Section 1.5: Stats band — the receipts */}
      <StatsBand />

      {/* Section 2: Film strip scroll — Moana / "filter out the 6/10's" */}
      <FilmStripScroll />

      {/* Section 2.25: Five tiers of discovery */}
      <FiveTiers />

      {/* Section 2.5: How Selects Works — 3D layered process card */}
      <ProcessCard />

      {/* Section 2.75: Discover Your Select — draggable film cards */}
      <DiscoverCards />

      {/* Section 3: Origin story — "Why Selects" */}
      <OriginStory />

      {/* Section 3: "YOUR CINEMATIC SOUL" CTA with mosaic effect */}
      <SoulCTA onActivate={scrollToOnboarding} />

      {/* Section 4: Onboarding flow */}
      <div ref={onboardingRef}>
        <OnboardingFlow />
      </div>

      {/* Footer */}
      <Footer />
    </main>
  );
}
