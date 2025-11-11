import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

const WelcomePopup: React.FC = () => {
  const { user, welcomeReady, clearWelcome } = useAuth();
  if (!welcomeReady || !user?.username) return null;

  return (
    <div
      onClick={clearWelcome}
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '12px 16px',
        borderRadius: 10,
        background: 'rgba(40, 40, 55, 0.85)',
        color: 'white',
        fontSize: 14,
        boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
        zIndex: 10000,
        backdropFilter: 'blur(4px)'
      }}
      aria-live="polite"
      role="status"
      title="Dismiss"
    >
      {`Welcome, ${user.username}`}
    </div>
  );
};

export default WelcomePopup;
