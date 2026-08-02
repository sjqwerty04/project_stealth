"use client";

import Logo from "@/components/ui/Logo";

export default function Footer() {
  return (
    <footer className="w-full py-16 px-8 bg-bg-primary border-t border-white/5">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-8">
        <Logo size="sm" variant="transparent" />

        <p
          className="text-white/40 text-lg text-center"
          style={{
            fontFamily:
              "var(--font-playfair), 'Playfair Display', Georgia, serif",
            fontStyle: "italic",
          }}
        >
          My Selects, My Film
        </p>

        <div className="flex items-center gap-6 text-white/20 text-xs tracking-[0.15em] uppercase">
          <span>selects.film</span>
          <span className="w-1 h-1 rounded-full bg-white/10" />
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
