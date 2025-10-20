export type Playlist = {
  id: string
  title: string
  cover: string
  region: string
}

export type Category = {
  id: string
  title: string
  playlists: Playlist[]
}

export const recentlyPlayed: Playlist[] = [
  { id: 'rp1', title: 'Daily Mix 1', cover: 'https://picsum.photos/id/1015/400/400', region: 'US' },
  { id: 'rp2', title: 'Daily Mix 2', cover: 'https://picsum.photos/id/1016/400/400', region: 'GB' },
  { id: 'rp3', title: 'Chill Vibes', cover: 'https://picsum.photos/id/1025/400/400', region: 'DE' },
  { id: 'rp4', title: 'K-Indie', cover: 'https://picsum.photos/id/1035/400/400', region: 'KR' },
  { id: 'rp5', title: 'Synthwave', cover: 'https://picsum.photos/id/1045/400/400', region: 'US' },
  { id: 'rp6', title: 'City Pop', cover: 'https://picsum.photos/id/1055/400/400', region: 'JP' },
  { id: 'rp7', title: 'Focus Beats', cover: 'https://picsum.photos/id/1065/400/400', region: 'CA' },
  { id: 'rp8', title: 'Retro Rock', cover: 'https://picsum.photos/id/1075/400/400', region: 'AU' }
]

export const categories: Category[] = [
  {
    id: 'trending',
    title: 'Trending now',
    playlists: [
      { id: '1', title: 'Global Hits', cover: 'https://picsum.photos/id/201/400/400', region: 'US' },
      { id: '2', title: 'Fresh Finds', cover: 'https://picsum.photos/id/202/400/400', region: 'GB' },
      { id: '3', title: 'Top Latino', cover: 'https://picsum.photos/id/203/400/400', region: 'MX' },
      { id: '4', title: 'K-Pop Now', cover: 'https://picsum.photos/id/204/400/400', region: 'KR' },
      { id: '9', title: 'Afrobeats Heat', cover: 'https://picsum.photos/id/205/400/400', region: 'NG' },
      { id: '10', title: 'Indie Radar', cover: 'https://picsum.photos/id/206/400/400', region: 'FR' }
    ]
  },
  {
    id: 'by-region',
    title: 'By region',
    playlists: [
      { id: '5', title: 'USA Top 100', cover: 'https://picsum.photos/id/301/400/400', region: 'US' },
      { id: '6', title: 'UK Top 100', cover: 'https://picsum.photos/id/302/400/400', region: 'GB' },
      { id: '7', title: 'Japan Top 100', cover: 'https://picsum.photos/id/303/400/400', region: 'JP' },
      { id: '8', title: 'Brazil Top 100', cover: 'https://picsum.photos/id/304/400/400', region: 'BR' }
    ]
  }
]
