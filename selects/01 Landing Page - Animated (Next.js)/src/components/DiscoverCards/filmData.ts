export interface FilmCardData {
  tmdbId: number;
  title: string;
  year: number;
  rating: number;
  backdropPath: string;
  logoPath: string;
  isSelect: boolean;
}

export const FILM_CARDS: FilmCardData[] = [
  {
    tmdbId: 335983,
    title: "Venom",
    year: 2018,
    rating: 6.1,
    backdropPath: "/hNsYUryiwxcdeTMkaBcPF3iEg0p.jpg",
    logoPath: "/5JNhTDkT7yXhoLlwCaS3hAnavHi.png",
    isSelect: false,
  },
  {
    tmdbId: 338762,
    title: "Bloodshot",
    year: 2020,
    rating: 6.0,
    backdropPath: "/zlqMASc3vEtdym2OvXgE7fC6onT.jpg",
    logoPath: "/3VZHuUIKXPDX8pu3HsSIkBW4GGk.png",
    isSelect: false,
  },
  {
    tmdbId: 399566,
    title: "Godzilla vs. Kong",
    year: 2021,
    rating: 6.3,
    backdropPath: "/wWqTMWkEw6HouLd1zPZbZWxtAPr.jpg",
    logoPath: "/pA61GITcdkZQgnyODPzoVxL0NMG.png",
    isSelect: false,
  },
  {
    tmdbId: 436969,
    title: "The Suicide Squad",
    year: 2021,
    rating: 6.2,
    backdropPath: "/jlGmlFOcfo8n5tURmhC7YVd4Iyy.jpg",
    logoPath: "/zzNbOhqPqqadyMHcKYSPoE1wFC0.png",
    isSelect: false,
  },
  {
    tmdbId: 580489,
    title: "Venom: Let There Be Carnage",
    year: 2021,
    rating: 5.9,
    backdropPath: "/eENEf62tMXbhyVvdcXlnQz2wcuT.jpg",
    logoPath: "/11eE224H5dzYS2CNxez7dVcDXhe.png",
    isSelect: false,
  },
  {
    tmdbId: 508947,
    title: "Turning Red",
    year: 2022,
    rating: 6.1,
    backdropPath: "/fOy2Jurz9k6RnJnMUMRDAgBwru2.jpg",
    logoPath: "/ut7WBlw5q0odVHIpZSRgmm6Trkr.png",
    isSelect: false,
  },
  {
    tmdbId: 64690,
    title: "Drive",
    year: 2011,
    rating: 7.6,
    backdropPath: "/iymDDg4upZWgpbSeiE1JCjsSPBs.jpg",
    logoPath: "/3joUcZ9dgqpOlJXxxA0b2M9mkx5.png",
    isSelect: true,
  },
];

// Scatter positions for landscape cards (wider cards, so x spread is larger)
export const CARD_POSITIONS = [
  { x: -260, y: -130, rotation: -7 },
  { x: 180,  y: -150, rotation: 10 },
  { x: -280, y:  60,  rotation: -4 },
  { x: 200,  y:  50,  rotation:  6 },
  { x: -140, y:  170, rotation: -11 },
  { x: 160,  y:  170, rotation:   3 },
];
