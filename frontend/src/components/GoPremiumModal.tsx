// Full rewrite: GoPremium modal wiring to Pi Payments
import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { startPayment, formatIsoDate } from '../lib/piPayments';
import { useLanguage } from '../contexts/LanguageContext';
import { refreshUserSession } from '../lib/userSession';
import { useToast } from '@/hooks/use-toast';

type Props = { open: boolean; onClose: () => void };

export default function GoPremiumModal({ open, onClose }: Props) {
  const { currentLanguage, t } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState<null | 'weekly' | 'monthly' | 'yearly'>(null);

  async function pay(plan: 'weekly' | 'monthly' | 'yearly') {
    setLoading(plan);
    const res = await startPayment(plan, { locale: currentLanguage });
    setLoading(null);
    if (res.ok) {
      const date = formatIsoDate(res.premium_until, currentLanguage);
      toast({ title: t('premium_activated') || 'Premium activated', description: `${t('until') || 'until'} ${date}` });
      await refreshUserSession();
      onClose();
    } else {
      toast({ title: t('payment_failed') || 'Payment failed', description: res.error || t('try_again') || 'Try again', variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v)=>{ if(!v) onClose(); }}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] p-0 border border-border bg-background overflow-y-auto scrollbar-hide">
        <div className="relative w-full mx-auto p-4 md:p-6">
          <button onClick={onClose} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-secondary/50 hover:bg-secondary flex items-center justify-center transition-colors z-10">
            <X className="w-4 h-4" />
          </button>

          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-2">{t('premium_version') || 'Premium Version'}</h2>
          <p className="text-muted-foreground text-xs md:text-sm max-w-md px-4 mx-auto text-center mb-4">{t('premium_description') || 'Unlock premium features and support development.'}</p>

          <div className="w-full max-w-md space-y-2 pt-2 px-4 mx-auto">
            <button disabled={!!loading} onClick={()=>pay('weekly')} className={`w-full p-3 rounded-xl border-2 ${loading==='weekly'?'opacity-70':''} border-border bg-card hover:bg-accent transition-all`}>
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <div className="font-semibold text-foreground text-sm">{t('weekly_plan') || 'Weekly Plan'}</div>
                  <div className="text-xs text-muted-foreground">7 {t('days') || 'days'}</div>
                </div>
                <div className="text-lg font-bold text-foreground">1 π</div>
              </div>
            </button>
            <button disabled={!!loading} onClick={()=>pay('monthly')} className={`w-full p-3 rounded-xl border-2 ${loading==='monthly'?'opacity-70':''} border-border bg-card hover:bg-accent transition-all`}>
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <div className="font-semibold text-foreground text-sm">{t('monthly_plan') || 'Monthly Plan'}</div>
                  <div className="text-xs text-muted-foreground">30 {t('days') || 'days'}</div>
                </div>
                <div className="text-lg font-bold text-foreground">3.14 π</div>
              </div>
            </button>
            <button disabled={!!loading} onClick={()=>pay('yearly')} className={`w-full p-3 rounded-xl border-2 ${loading==='yearly'?'opacity-70':''} border-border bg-card hover:bg-accent transition-all`}>
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <div className="font-semibold text-foreground text-sm">{t('yearly_plan') || 'Yearly Plan'}</div>
                  <div className="text-xs text-muted-foreground">365 {t('days') || 'days'}</div>
                </div>
                <div className="text-lg font-bold text-foreground">31.4 π</div>
              </div>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
