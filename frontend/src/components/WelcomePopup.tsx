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
        padding: '12px 18px',
        borderRadius: 14,
        background: 'rgba(76, 29, 149, 0.85)', // semi-transparent dark purple
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 500,
        letterSpacing: 0.3,
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        zIndex: 10000,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        transition: 'opacity 0.4s ease'
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
