import { Link } from 'react-router-dom';
import appLogo from '@/assets/app-logo.png';
import HeaderProfileMenu from './HeaderProfileMenu';
const Header = () => {
  // Language and premium handled inside HeaderProfileMenu now.
  return <header className="fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-md border-b border-border/50 z-50">
      <div className="h-full px-4 md:px-6 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 md:gap-3 group">
          <img src={appLogo} alt="PurpleBeats Logo" className="w-[42px] h-[42px] md:w-[52px] md:h-[52px] rounded-lg group-hover:scale-105 transition-transform" />
          <span className="text-lg md:text-xl font-bold">
            <span className="bg-gradient-to-b from-amber-500 via-amber-600 to-yellow-700 bg-clip-text text-transparent">
              Purple
            </span>
            <span className="bg-gradient-to-b from-amber-500 via-amber-600 to-yellow-700 bg-clip-text text-transparent">
              Beats
            </span>
          </span>
        </Link>

        {/* Profile Dropdown */}
        <HeaderProfileMenu />
      </div>

      {/* Premium modal moved into HeaderProfileMenu */}
    </header>;
};
export default Header;