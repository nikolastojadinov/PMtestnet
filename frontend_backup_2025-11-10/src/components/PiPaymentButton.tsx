import { useState } from 'react';
import { createPiPayment, isPiBrowser } from '@/lib/pi';

export default function PiPaymentButton() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');
  if (typeof window !== 'undefined' && !isPiBrowser()) return null;

  const onClick = async () => {
    setBusy(true); setStatus('');
    try {
      const res = await createPiPayment({ amount: 0.01, memo: 'Test Payment', metadata: { app: 'Purple Music' } });
      if (res?.status === 'completed') {
        setStatus('Payment completed successfully');
      } else {
        setStatus('Payment finished with unknown status');
      }
    } catch (e: any) {
      setStatus('Payment failed, please retry.');
    } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onClick}
        disabled={busy}
        className="px-3 py-2 rounded text-sm disabled:opacity-60 bg-gradient-to-r from-purple-700 via-purple-600 to-yellow-500 text-white hover:brightness-110"
      >
        {busy ? 'Processing…' : 'Pay 0.01π (Test)'}
      </button>
      {status && <span className="text-xs text-muted-foreground max-w-[260px] truncate">{status}</span>}
    </div>
  );
}
