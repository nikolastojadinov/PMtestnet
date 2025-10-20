export type Playlist = {
  id: string
  title: string
  cover?: string | null
  region?: string | null
}

export type Category = {
  id: string
  title: string
}

export const CATEGORY_TITLES = [
  'Most popular',
  'Trending now',
  'Best of 80s',
  'Best of 90s',
  'Best of 2000s'
] as const
