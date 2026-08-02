"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import DataUpload from "./DataUpload";
import QuestionCard from "./QuestionCard";
import LoadingState from "./LoadingState";
import KnowledgeGraph from "./KnowledgeGraph";
import WaitlistForm from "./WaitlistForm";

type Step = "upload" | "q1" | "q2" | "q3" | "loading" | "graph" | "waitlist";

interface PersonaData {
  persona_name: string;
  persona_color: string;
  short_description: string;
  graph_nodes: { id: string; label: string; type: string }[];
  graph_edges: {
    source: string;
    target: string;
    label: string;
    type: string;
  }[];
}

export default function OnboardingFlow() {
  const [step, setStep] = useState<Step>("upload");
  const [answers, setAnswers] = useState({
    files: [] as File[],
    links: [] as string[],
    positiveAnchor: "",
    negativeAnchor: "",
    preferences: [] as string[],
  });
  const [persona, setPersona] = useState<PersonaData | null>(null);

  const handleUpload = (data: { files: File[]; links: string[] }) => {
    setAnswers((prev) => ({ ...prev, files: data.files, links: data.links }));
    setStep("q1");
  };

  const handleQ1 = (answer: string | string[]) => {
    const val = Array.isArray(answer) ? answer[0] : answer;
    setAnswers((prev) => ({ ...prev, positiveAnchor: val }));
    setTimeout(() => setStep("q2"), 300);
  };

  const handleQ2 = (answer: string | string[]) => {
    const val = Array.isArray(answer) ? answer[0] : answer;
    setAnswers((prev) => ({ ...prev, negativeAnchor: val }));
    setTimeout(() => setStep("q3"), 300);
  };

  const handleQ3 = (answer: string | string[]) => {
    const prefs = Array.isArray(answer) ? answer : [answer];
    setAnswers((prev) => ({ ...prev, preferences: prefs }));
    setTimeout(() => {
      setStep("loading");
      generatePersona(prefs);
    }, 300);
  };

  const generatePersona = useCallback(
    async (prefs: string[]) => {
      try {
        const res = await fetch("/api/generate-persona", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            positiveAnchor: answers.positiveAnchor,
            negativeAnchor: answers.negativeAnchor,
            preferences: prefs,
          }),
        });
        const data = await res.json();
        setPersona(data);

        // Wait a minimum of 8 seconds for the loading experience
        setTimeout(() => setStep("graph"), 8000);
      } catch (error) {
        console.error("Failed to generate persona:", error);
        // Fallback — go to waitlist directly
        setTimeout(() => setStep("waitlist"), 3000);
      }
    },
    [answers.positiveAnchor, answers.negativeAnchor]
  );

  const handleWaitlist = async (data: {
    firstName: string;
    lastName: string;
    email: string;
    newsletterOptIn: boolean;
  }) => {
    try {
      await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          personaName: persona?.persona_name,
          personaColor: persona?.persona_color,
          positiveAnchor: answers.positiveAnchor,
          negativeAnchor: answers.negativeAnchor,
          preferences: answers.preferences,
        }),
      });
    } catch (error) {
      console.error("Failed to save to waitlist:", error);
    }
  };

  return (
    <section className="min-h-screen w-full bg-bg-primary flex items-center justify-center py-20 relative overflow-hidden">
      {/* Subtle background parallax elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-[0.02]"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)",
            top: "10%",
            right: "-10%",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-[0.02]"
          style={{
            background:
              "radial-gradient(circle, rgba(232,119,34,0.3) 0%, transparent 70%)",
            bottom: "10%",
            left: "-5%",
          }}
        />
      </div>

      <div className="relative z-10 w-full">
        <AnimatePresence mode="wait">
          {step === "upload" && (
            <motion.div key="upload">
              <DataUpload onNext={handleUpload} onSkip={() => setStep("q1")} />
            </motion.div>
          )}

          {step === "q1" && (
            <motion.div key="q1">
              <QuestionCard
                questionNumber={1}
                question="If you had a private theater for the night — one film, on repeat, forever. What's playing?"
                type="film-search"
                onAnswer={handleQ1}
              />
            </motion.div>
          )}

          {step === "q2" && (
            <motion.div key="q2">
              <QuestionCard
                questionNumber={2}
                question="The one everyone loved — but didn't quite land for you."
                type="film-search"
                onAnswer={handleQ2}
              />
            </motion.div>
          )}

          {step === "q3" && (
            <motion.div key="q3">
              <QuestionCard
                questionNumber={3}
                question="What pulls you into a film?"
                type="multi-select"
                options={[
                  { id: "visual", label: "Visual Style", icon: "eye" },
                  { id: "storytelling", label: "Storytelling", icon: "book" },
                  { id: "acting", label: "Acting", icon: "users" },
                  {
                    id: "directing",
                    label: "Directing",
                    icon: "clapperboard",
                  },
                ]}
                onAnswer={handleQ3}
              />
            </motion.div>
          )}

          {step === "loading" && (
            <motion.div key="loading">
              <LoadingState />
            </motion.div>
          )}

          {step === "graph" && persona && (
            <motion.div key="graph" className="w-full flex flex-col items-center">
              <KnowledgeGraph
                nodes={persona.graph_nodes}
                edges={persona.graph_edges}
                personaName={persona.persona_name}
                personaColor={persona.persona_color}
                personaDescription={persona.short_description}
              />
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => setStep("waitlist")}
                  className="px-8 py-3 bg-white text-black rounded-full text-sm font-medium tracking-[0.15em] uppercase hover:bg-white/90 transition-colors cursor-pointer"
                >
                  Join the Waitlist
                </button>
              </div>
            </motion.div>
          )}

          {step === "waitlist" && (
            <motion.div key="waitlist">
              <WaitlistForm
                personaName={persona?.persona_name}
                personaColor={persona?.persona_color}
                onSubmit={handleWaitlist}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
