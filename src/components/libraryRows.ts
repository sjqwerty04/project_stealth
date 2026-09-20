export type LibraryCounts = {
  watched: number;
  wallet: number;
  saved: number;
  theaters: number;
  sharedLists: number;
  sharedPeople: number;
};

export type LibraryRow = {
  id: string;
  label: string;
  meta: string;
  to: string;
};

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export function libraryRows(counts: LibraryCounts): LibraryRow[] {
  return [
    {
      id: 'watched',
      label: 'Watched',
      meta: `${counts.watched} ${plural(counts.watched, 'FILM', 'FILMS')}`,
      to: '/watched#timeline',
    },
    {
      id: 'wallet',
      label: 'The Wallet',
      meta: `${counts.wallet} ${plural(counts.wallet, 'FILM', 'FILMS')} CLOSEST TO YOU`,
      to: '/liked',
    },
    {
      id: 'saved',
      label: 'Saved',
      meta: `${counts.saved} WAITING`,
      to: '/saved',
    },
    {
      id: 'theaters',
      label: 'Theaters',
      meta: `${counts.theaters} ${plural(counts.theaters, 'FACET', 'FACETS')} YOU KEPT`,
      to: '/theaters',
    },
    {
      id: 'shared-lists',
      label: 'Shared lists',
      meta: `${counts.sharedLists} ${plural(counts.sharedLists, 'LIST', 'LISTS')} · ${counts.sharedPeople} ${plural(
        counts.sharedPeople,
        'PERSON',
        'PEOPLE',
      )}`,
      to: '/shared',
    },
  ];
}
