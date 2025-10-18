import '../styles/globals.css'
import Header from '../components/Header'
import Footer from '../components/Footer'

export const metadata = {
  title: 'Purple Music',
  description: 'Static prototype layout'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-pm-primary text-white">
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-6 space-y-8">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
