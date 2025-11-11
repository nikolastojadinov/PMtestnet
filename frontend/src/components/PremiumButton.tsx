import React from 'react';
import { usePiSDK } from './PiSDKProvider';
import { useAuth } from '@/contexts/AuthContext';

export default function PremiumButton() {
  const { user } = useAuth();
  const { createPayment } = usePiSDK();

  const handlePremium = async () => {
    if (!user) {
      alert('Please log in with Pi first.');
      return;
    }
    await createPayment(1, 'Purple Music Weekly Premium', { plan: 'weekly' });
  };

  return (
    <button
      onClick={handlePremium}
      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-semibold shadow-sm transition-colors"
    >
      Go Premium (1 π / week)
    </button>
  );
}
