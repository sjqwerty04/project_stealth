export interface ProcessStep {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  widthPercent: number;
  rotateOnHover: number;
  translateZ: number;
  translateY: number;
}

export const PROCESS_STEPS: ProcessStep[] = [
  {
    id: 1,
    title: "The Reel",
    subtitle: "Your history, finally useful",
    description:
      "Connect Letterboxd, IMDB, or your streaming history. Selects inherits years of taste data the moment you arrive.",
    widthPercent: 100,
    rotateOnHover: -8,
    translateZ: 0,
    translateY: 0,
  },
  {
    id: 2,
    title: "Orbit",
    subtitle: "Discover by instinct, not genre",
    description:
      "Four directions. Mood, story, theme, visual. Every swipe teaches Selects something no genre tag ever could.",
    widthPercent: 85,
    rotateOnHover: 5,
    translateZ: 40,
    translateY: -70,
  },
  {
    id: 3,
    title: "The Pull",
    subtitle: "AI that works while you browse",
    description:
      "Selects traces the invisible thread between every film you touch — shared cinematographers, structural DNA, the unnamed feeling.",
    widthPercent: 70,
    rotateOnHover: -3,
    translateZ: 80,
    translateY: -140,
  },
  {
    id: 4,
    title: "Your Select",
    subtitle: "One film. Yours.",
    description:
      "Not trending. Not popular. Yours.",
    widthPercent: 55,
    rotateOnHover: 2,
    translateZ: 120,
    translateY: -210,
  },
];
