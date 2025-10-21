import './globals.css';
import Header from '../components/Header';
import FooterNav from '../components/FooterNav';

export const metadata = { title: 'Purple Music', description: 'Fast legal music app for Pi Browser' };

export default function RootLayout({ children }:{children:React.ReactNode}) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="container">{children}</main>
        <FooterNav />
      </body>
    </html>
  );
}
