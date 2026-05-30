import { create } from 'zustand';

// DNA navigates a people<->films graph. The path alternates between movie nodes
// (whose cast/crew become the next dots) and person nodes (whose films become the
// next dots), e.g. Blink Twice -> Channing Tatum -> Magic Mike -> ...

export interface DNAMovie {
  id: number;
  title: string;
  year: string;
  posterPath: string | null;
  backdropPath: string | null;
  logoPath: string | null;
}

export interface DNAPerson {
  id: number;
  name: string;
  profilePath: string | null;
  // How this person connected to the movie we came from (e.g. character or job).
  role?: string;
}

export type DNANode =
  | { kind: 'movie'; movie: DNAMovie }
  | { kind: 'person'; person: DNAPerson };

interface DNAState {
  path: DNANode[];
  currentIndex: number;

  enter: (movie: DNAMovie) => void;
  pushNode: (node: DNANode) => void;
  jumpTo: (index: number) => void;
  goBack: () => boolean;
  reset: () => void;
}

export const nodeId = (node: DNANode): string =>
  node.kind === 'movie' ? `m${node.movie.id}` : `p${node.person.id}`;

export const nodeLabel = (node: DNANode): string =>
  node.kind === 'movie' ? node.movie.title : node.person.name;

export const useDNAStore = create<DNAState>((set, get) => ({
  path: [],
  currentIndex: -1,

  enter: (movie: DNAMovie) => {
    set({ path: [{ kind: 'movie', movie }], currentIndex: 0 });
  },

  pushNode: (node: DNANode) => {
    const state = get();
    // Truncate any forward history when branching from an earlier node.
    const newPath = state.path.slice(0, state.currentIndex + 1);
    newPath.push(node);
    set({ path: newPath, currentIndex: newPath.length - 1 });
  },

  jumpTo: (index: number) => {
    const state = get();
    if (index < 0 || index >= state.path.length) return;
    set({ currentIndex: index });
  },

  goBack: () => {
    const state = get();
    if (state.currentIndex <= 0) return false;
    set({ currentIndex: state.currentIndex - 1 });
    return true;
  },

  reset: () => set({ path: [], currentIndex: -1 }),
}));
