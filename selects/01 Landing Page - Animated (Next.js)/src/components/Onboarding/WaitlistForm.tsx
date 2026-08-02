"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface WaitlistFormProps {
  personaName?: string;
  personaColor?: string;
  onSubmit: (data: {
    firstName: string;
    lastName: string;
    email: string;
    newsletterOptIn: boolean;
  }) => void;
}

export default function WaitlistForm({
  personaName,
  personaColor,
  onSubmit,
}: WaitlistFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [newsletter, setNewsletter] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !email) return;
    onSubmit({
      firstName,
      lastName,
      email,
      newsletterOptIn: newsletter,
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-16 px-8"
      >
        {personaName && (
          <div
            className="inline-block px-6 py-2 rounded-full text-sm font-medium tracking-[0.2em] uppercase mb-6"
            style={{
              backgroundColor: `${personaColor}20`,
              color: personaColor,
              border: `1px solid ${personaColor}40`,
            }}
          >
            {personaName}
          </div>
        )}
        <h3
          className="text-3xl mb-4"
          style={{
            fontFamily:
              "var(--font-playfair), 'Playfair Display', Georgia, serif",
            fontStyle: "italic",
          }}
        >
          You&apos;re on the list, {firstName}.
        </h3>
        <p className="text-white/50 text-lg max-w-md mx-auto mb-2">
          Tonight&apos;s still on you. The next one is on us.
        </p>
        <p className="text-white/30 text-sm tracking-wider uppercase">
          No algorithm. No agenda. No noise.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-md mx-auto px-8"
    >
      <h3
        className="text-center mb-2"
        style={{
          fontFamily:
            "var(--font-playfair), 'Playfair Display', Georgia, serif",
          fontStyle: "italic",
          fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
        }}
      >
        Be one of the first to be understood.
      </h3>
      <p className="text-center text-white/40 text-sm mb-8">
        Early members shape the product — and get the sharpest recommendations
        from day one.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            required
            className="flex-1 px-5 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/25 text-sm outline-none focus:border-white/25 transition-colors"
          />
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            className="flex-1 px-5 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/25 text-sm outline-none focus:border-white/25 transition-colors"
          />
        </div>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/25 text-sm outline-none focus:border-white/25 transition-colors"
        />

        <label className="flex items-center gap-3 cursor-pointer py-2">
          <input
            type="checkbox"
            checked={newsletter}
            onChange={(e) => setNewsletter(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/5 accent-[var(--accent)]"
          />
          <span className="text-white/40 text-sm">
            Keep me in the loop — I want to hear what&apos;s next
          </span>
        </label>

        <button
          type="submit"
          className="w-full py-4 bg-white text-black rounded-full text-sm font-medium tracking-[0.15em] uppercase hover:bg-white/90 transition-colors cursor-pointer"
        >
          Find my film →
        </button>

        <p className="text-center text-white/20 text-xs tracking-wider uppercase pt-2">
          No algorithm. No agenda. No noise.
        </p>
      </form>
    </motion.div>
  );
}
