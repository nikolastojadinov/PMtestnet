import React, { useEffect, useState } from 'react';
import { usePiSDK } from './PiSDKProvider';

const WelcomePopup: React.FC = () => {
  const { user, loading } = usePiSDK();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!loading && user?.username) {
      setName(user.username);
      setOpen(true);
      const t1 = setTimeout(() => setVisible(true), 10);
      const t2 = setTimeout(() => {
        setVisible(false);
        const t3 = setTimeout(() => setOpen(false), 300);
        return () => clearTimeout(t3);
      }, 3000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [loading, user?.username]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none flex items-center justify-center">
      <div
        className={
          'pointer-events-auto select-none px-6 py-4 rounded-xl shadow-xl ' +
          'bg-purple-900/80 text-white backdrop-blur-sm ' +
          'transition-opacity duration-300 ' +
          (visible ? 'opacity-100' : 'opacity-0')
        }
      >
        <span className="font-medium">Welcome, {name}</span>
      </div>
    </div>
  );
};

export default WelcomePopup;
