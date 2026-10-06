import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Kind = 'success' | 'error' | 'info';
interface Item { id: number; kind: Kind; text: string }

const Ctx = createContext<(text: string, kind?: Kind) => void>(() => {});

let seq = 0;

/** 화면 위쪽에 잠깐 떴다 사라지는 짧은 알림 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);

  const show = useCallback((text: string, kind: Kind = 'info') => {
    const id = ++seq;
    setItems((list) => [...list.slice(-2), { id, kind, text }]);
    setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), kind === 'error' ? 4000 : 2500);
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((i) => (
          <div
            key={i.id}
            role={i.kind === 'error' ? 'alert' : 'status'}
            className={`animate-fade-in max-w-sm rounded-full px-4 py-2.5 text-[15px] font-medium shadow-lg ${
              i.kind === 'error' ? 'bg-rose-600 text-white' : i.kind === 'success' ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-line'
            }`}
          >
            {i.kind === 'success' ? '✅ ' : i.kind === 'error' ? '⚠️ ' : ''}
            {i.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
