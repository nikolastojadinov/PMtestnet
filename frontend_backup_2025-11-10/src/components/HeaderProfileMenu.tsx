import { useState, useMemo } from 'react';
import { User, Crown, Globe, Shield, FileText } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import GoPremiumModal from './GoPremiumModal';
import { useLanguage, languages } from '@/contexts/LanguageContext';
import { useSession, isPremium } from '@/lib/userSession';
import { Link } from 'react-router-dom';

export default function HeaderProfileMenu() {
  const { t, setLanguage, currentLanguage } = useLanguage();
  const { user } = useSession();
  const [languageDialogOpen, setLanguageDialogOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);

  const premiumUntilLabel = useMemo(() => {
    if (!user?.premium_until) return '';
    try { return new Date(user.premium_until).toLocaleDateString(currentLanguage || 'en'); } catch { return user.premium_until.slice(0,10); }
  }, [user?.premium_until, currentLanguage]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-9 h-9 md:w-10 md:h-10 bg-secondary hover:bg-secondary/80 rounded-full flex items-center justify-center transition-all hover:scale-105">
            <User className="w-4 h-4 md:w-5 md:h-5 text-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-card border-border">
          {isPremium(user) ? (
            <DropdownMenuItem className="py-3">
              <Crown className="w-4 h-4 mr-3 text-amber-500" />
              <span>{t('premium_member_until') || 'Premium member until'} {premiumUntilLabel}</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setPremiumOpen(true)} className="cursor-pointer py-3 bg-gradient-to-r from-amber-500/10 to-yellow-600/10 hover:from-amber-500/20 hover:to-yellow-600/20 border border-amber-500/20">
              <Crown className="w-4 h-4 mr-3 text-amber-500" />
              <span className="bg-gradient-to-b from-amber-500 via-amber-600 to-yellow-700 bg-clip-text text-transparent font-semibold">{t('go_premium') || 'Go Premium'}</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="cursor-pointer py-3">
            <Link to="/privacy-policy" className="flex items-center">
              <Shield className="w-4 h-4 mr-3" />
              <span>{t('privacy_policy')}</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer py-3">
            <FileText className="w-4 h-4 mr-3" />
            <span>{t('terms_of_service')}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="px-2 py-2">
            <div className="flex items-center gap-2 text-sm mb-2"><Globe className="w-4 h-4" /> {t('language')}</div>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto scrollbar-hide">
              {languages.map(lang => (
                <button key={lang.code} onClick={()=> setLanguage(lang.code)} className={`text-left px-3 py-2 rounded-md ${currentLanguage===lang.code ? 'bg-secondary font-semibold' : 'hover:bg-secondary/80'}`}>
                  {lang.nativeName}
                </button>
              ))}
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <GoPremiumModal open={premiumOpen} onClose={()=> setPremiumOpen(false)} />
    </>
  );
}
