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

export const categories: Category[] = [
  {
    id: 'trending',
    title: 'Trending now',
    playlists: [
      { id: '1', title: 'Global Hits', cover: '/covers/cover1.jpg', region: 'US' },
      { id: '2', title: 'Fresh Finds', cover: '/covers/cover2.jpg', region: 'GB' },
      { id: '3', title: 'Top Latino', cover: '/covers/cover3.jpg', region: 'MX' },
      { id: '4', title: 'K-Pop Now', cover: '/covers/cover4.jpg', region: 'KR' }
    ]
  },
  {
    id: 'by-region',
    title: 'By region',
    playlists: [
      { id: '5', title: 'USA Top 100', cover: '/covers/cover5.jpg', region: 'US' },
      { id: '6', title: 'UK Top 100', cover: '/covers/cover6.jpg', region: 'GB' },
      { id: '7', title: 'Japan Top 100', cover: '/covers/cover7.jpg', region: 'JP' },
      { id: '8', title: 'Brazil Top 100', cover: '/covers/cover8.jpg', region: 'BR' }
    ]
  }
]
