import React from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
import { getOrCreateGuestId } from '@/lib/guestUser';
import { motion, AnimatePresence } from 'framer-motion';

declare global {
  interface Window {
    Pi: any;
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
};

async function updatePremium(plan: 'weekly' | 'monthly') {
  // Frontend-only mock update for user "Guest"
  const now = new Date();
  const until = new Date(now);
  until.setDate(until.getDate() + (plan === 'weekly' ? 7 : 30));
  try {
    const uid = getOrCreateGuestId();
    const { error } = await supabase
      .from('users')
      .upsert({ user_id: uid, wallet: 'Guest', premium_until: until.toISOString() }, { onConflict: 'user_id' });
    if (error) throw error;
  } catch (e) {
    // non-fatal in UI
    console.warn('premium update failed', e);
  }
}

export default function PremiumPopup({ open, onClose }: Props) {
  const { t } = useTranslation();

  const createPayment = (plan: 'weekly' | 'monthly') => {
    const amount = plan === 'weekly' ? 1 : 3.14;
    const Pi = typeof window !== 'undefined' ? window.Pi : undefined;
    if (!Pi || !Pi.createPayment) {
      // Fallback: pretend success in non-Pi environments
      updatePremium(plan).finally(onClose);
      return;
    }

    Pi.createPayment(
      {
        amount,
        memo: 'Purple Music Premium Subscription',
        metadata: { plan },
      },
      {
        onReadyForServerApproval: (paymentId: string) => {
          // App server approval would happen here in a real integration
          // We keep frontend-only per instruction
        },
        onReadyForServerCompletion: async (paymentId: string) => {
          await updatePremium(plan);
          onClose();
        },
        onCancel: () => {
          onClose();
        },
        onError: (error: any) => {
          console.error(error);
          onClose();
        },
      }
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-x-0 top-16 md:top-20 z-50 flex items-start justify-center px-4 pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="pointer-events-auto w-full max-w-md rounded-2xl border border-purple-800/50 bg-[#0b0010]/95 shadow-lg backdrop-blur p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold">{t('premium.title')}</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-200">✕</button>
            </div>
            <p className="mt-2 text-sm text-gray-300">{t('premium.description')}</p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => createPayment('weekly')}
                className="px-4 py-2 rounded-md bg-gradient-to-r from-purple-600 via-fuchsia-500 to-amber-300 text-black font-medium shadow hover:brightness-110"
              >
                {t('premium.weekly')}
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => createPayment('monthly')}
                className="px-4 py-2 rounded-md bg-gradient-to-r from-purple-600 via-fuchsia-500 to-amber-300 text-black font-medium shadow hover:brightness-110"
              >
                {t('premium.monthly')}
              </motion.button>
            </div>
            <div className="mt-3">
              <button onClick={onClose} className="px-3 py-2 text-sm text-gray-300 hover:text-gray-100">{t('premium.later')}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
