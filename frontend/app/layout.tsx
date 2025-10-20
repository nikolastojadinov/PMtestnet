import '../styles/globals.css'
import '../styles/theme.css'

export const metadata = {
  title: 'Purple Music',
  description: 'Playlists powered by Supabase',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
