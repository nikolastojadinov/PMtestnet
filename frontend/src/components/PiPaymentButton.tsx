import { useState } from 'react';
import { createPiPayment, isPiBrowser } from '@/lib/pi';

export default function PiPaymentButton() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');
  if (typeof window !== 'undefined' && !isPiBrowser()) return null;

  const onClick = async () => {
    setBusy(true); setStatus('');
    try {
      const res = await createPiPayment({ amount: 0.01, memo: 'PM Test payment', metadata: { test: true } });
      setStatus(`Completed: ${res.paymentId} tx ${res.txid}`);
    } catch (e: any) {
      setStatus(`Error: ${e?.message || String(e)}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-2">
      <button onClick={onClick} disabled={busy} className="px-3 py-2 rounded bg-amber-600 text-black text-sm hover:bg-amber-500 disabled:opacity-60">
        {busy ? 'Processing…' : 'Test Pi Payment (0.01π)'}
      </button>
      {status && <span className="text-xs text-muted-foreground max-w-[240px] truncate">{status}</span>}
    </div>
  );
}
