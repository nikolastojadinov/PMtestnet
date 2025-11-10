import React, { useEffect, useRef, useState } from 'react';

interface LogEntry {
  id: number;
  level: 'log' | 'warn' | 'error' | 'info';
  ts: string;
  msg: string;
}

function isDebugEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('debug') === '1') return true;
    if (localStorage.getItem('pm_debug') === '1') return true;
  } catch {}
  return false;
}

let originalConsole: Partial<Record<'log' | 'warn' | 'error' | 'info', any>> | null = null;

const DebugOverlay: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(() => isDebugEnabled());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Preserve original console
    if (!originalConsole) {
      originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
      };
    }

    const push = (level: LogEntry['level'], args: any[]) => {
      const ts = new Date().toISOString().split('T')[1].replace('Z', '');
      const msg = args.map(a => {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === 'object') {
          try { return JSON.stringify(a); } catch { return String(a); }
        }
        return String(a);
      }).join(' ');
      setLogs(l => {
        const entry: LogEntry = { id: nextId.current++, level, ts, msg };
        const merged = [...l, entry];
        // limit to last 300
        if (merged.length > 300) merged.splice(0, merged.length - 300);
        return merged;
      });
    };

    const wrap = (lvl: LogEntry['level']) => (...args: any[]) => {
      try { push(lvl, args); } catch {}
      (originalConsole?.[lvl] || console.log).apply(console, args);
    };

    console.log = wrap('log');
    console.warn = wrap('warn');
    console.error = wrap('error');
    console.info = wrap('info');

    const onError = (event: ErrorEvent) => {
      push('error', [event.message, event.filename + ':' + event.lineno + ':' + event.colno]);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      push('error', ['UnhandledRejection', event.reason]);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      // Restore original console
      if (originalConsole) {
        console.log = originalConsole.log || console.log;
        console.warn = originalConsole.warn || console.warn;
        console.error = originalConsole.error || console.error;
        console.info = originalConsole.info || console.info;
      }
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [enabled]);

  // Auto scroll to bottom when new logs arrive
  useEffect(() => {
    if (!enabled) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, enabled]);

  if (!enabled) return null;

  return (
    <div className="fixed left-0 right-0 bottom-0 z-[1000] max-h-[45vh] pointer-events-auto">
      <div className="m-2 rounded-md border border-purple-600/40 bg-black/85 backdrop-blur-sm shadow-lg flex flex-col" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
        <div className="flex items-center justify-between px-3 py-1 text-xs text-purple-300 bg-gradient-to-r from-purple-800/70 to-purple-500/40 rounded-t-md">
          <span>Debug Console (live) — {logs.length} msgs</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setLogs([]); }}
              className="px-2 py-0.5 rounded bg-purple-700/60 hover:bg-purple-600 text-[10px] text-white"
            >Clear</button>
            <button
              onClick={() => { setEnabled(false); }}
              className="px-2 py-0.5 rounded bg-red-600/70 hover:bg-red-600 text-[10px] text-white"
            >Close</button>
          </div>
        </div>
        <div className="overflow-y-auto text-[11px] leading-snug px-2 py-2 space-y-1 font-medium scrollbar-hide">
          {logs.map(l => (
            <div key={l.id} className={
              l.level === 'error' ? 'text-red-400' : l.level === 'warn' ? 'text-yellow-300' : 'text-gray-300'
            }>
              <span className="opacity-60 mr-1">[{l.ts}]</span>
              <span>{l.level.toUpperCase()}:</span> <span className="break-words whitespace-pre-wrap">{l.msg}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
};

export default DebugOverlay;
