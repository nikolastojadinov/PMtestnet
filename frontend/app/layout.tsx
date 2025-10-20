import '../styles/globals.css'
import '../styles/theme.css'
import Header from '../components/Header'
import Footer from '../components/Footer'

export const metadata = {
  title: 'Purple Music',
  description: 'Static UI preview'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[#0D001A] text-white font-sans">
        <Header />
        <main className="mx-auto max-w-6xl px-4 pt-20 pb-24 space-y-8">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
