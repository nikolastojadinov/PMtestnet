import { useEffect, useState } from 'react';

type Props = {
  username: string | null;
  visible: boolean;
  onClose: () => void;
  message?: string; // optional override
};

export default function WelcomePopup({ username, visible, onClose, message }: Props) {
  const [show, setShow] = useState(visible);

  useEffect(() => {
    setShow(visible);
    if (visible) {
      const t = setTimeout(() => { setShow(false); onClose(); }, 1500);
      return () => clearTimeout(t);
    }
  }, [visible, onClose]);

  if (!show) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div className="px-4 py-2 rounded-xl bg-secondary text-foreground shadow-lg animate-in fade-in-0 zoom-in-95 duration-300">
        {message || `Welcome, ${username ?? 'Pioneer'}!`}
      </div>
    </div>
  );
}
