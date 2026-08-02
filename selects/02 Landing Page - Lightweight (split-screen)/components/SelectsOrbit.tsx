"use client";

/**
 * SelectsOrbit — 3D rotating ring of film cards.
 * Pure CSS 3D transforms, no canvas, no image assets.
 * Replicates the Orbit mechanic from the Selects app screenshot.
 */

const FILMS: { title: string; year: string; genre: string; bg: string; accent: string }[] = [
  { title: "Eternal Sunshine",   year: "2004", genre: "Sci-fi romance",   bg: "#07111e", accent: "#1a4a6e" },
  { title: "Drive",              year: "2011", genre: "Neo-noir",         bg: "#0a0d0f", accent: "#3a1a1a" },
  { title: "Her",                year: "2013", genre: "Sci-fi drama",     bg: "#150a08", accent: "#5a2a10" },
  { title: "Parasite",           year: "2019", genre: "Thriller",         bg: "#080f0a", accent: "#1a3a1a" },
  { title: "Arrival",            year: "2016", genre: "First contact",    bg: "#08101a", accent: "#102a40" },
  { title: "Nomadland",          year: "2020", genre: "Drama",            bg: "#141008", accent: "#3a2a10" },
  { title: "Past Lives",         year: "2023", genre: "Romance",          bg: "#110d0f", accent: "#3a1a28" },
  { title: "Hail Mary",          year: "2025", genre: "Sci-fi",           bg: "#060810", accent: "#0a1430" },
  { title: "The Mummy",          year: "1999", genre: "Adventure",        bg: "#12100a", accent: "#3a2808" },
  { title: "Greenland",          year: "2024", genre: "Disaster",         bg: "#0a1014", accent: "#0a2030" },
  { title: "Roommates",          year: "2023", genre: "Comedy",           bg: "#0e0b14", accent: "#28103a" },
  { title: "Murderer",           year: "2024", genre: "Crime",            bg: "#0f0e10", accent: "#2a0a20" },
];

const CARD_W = 90;
const CARD_H = 130;
const RADIUS = 260;
const COUNT = FILMS.length;

export function SelectsOrbit() {
  return (
    <div className="orbit-scene" aria-hidden>
      <div className="orbit-ring">
        {FILMS.map((film, i) => {
          const deg = (i * 360) / COUNT;
          return (
            <div
              key={film.title}
              className="orbit-card"
              style={{
                transform: `rotateY(${deg}deg) translateZ(${RADIUS}px)`,
                width: CARD_W,
                height: CARD_H,
                background: film.bg,
                boxShadow: `0 0 0 1px rgba(255,255,255,0.07), 0 8px 32px rgba(0,0,0,0.6), inset 0 0 0 1px ${film.accent}`,
              }}
            >
              <div
                className="orbit-card-accent"
                style={{ background: film.accent }}
              />
              <div className="orbit-card-body">
                <div className="orbit-card-title">{film.title}</div>
                <div className="orbit-card-meta">
                  <span className="orbit-card-year">{film.year}</span>
                  <span className="orbit-card-genre">{film.genre}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
