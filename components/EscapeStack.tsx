import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

type EscapeLayer = {
  id: string;
  priority: number;
  order: number;
  onEscape: () => void;
};

type EscapeStackApi = {
  register: (id: string, onEscape: () => void, priority?: number) => void;
  unregister: (id: string) => void;
};

const EscapeStackContext = createContext<EscapeStackApi | null>(null);

/** Higher priority layers handle Escape first (confirm/modals before page back). */
export const ESCAPE_PRIORITY = {
  confirm: 100,
  modal: 80,
  detail: 50,
  home: 10,
} as const;

export const EscapeStackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const layersRef = useRef<EscapeLayer[]>([]);
  const orderRef = useRef(0);

  const register = useCallback((id: string, onEscape: () => void, priority = 50) => {
    const existing = layersRef.current.find(layer => layer.id === id);
    if (existing) {
      existing.onEscape = onEscape;
      existing.priority = priority;
      existing.order = ++orderRef.current;
      return;
    }
    layersRef.current.push({ id, priority, order: ++orderRef.current, onEscape });
  }, []);

  const unregister = useCallback((id: string) => {
    layersRef.current = layersRef.current.filter(layer => layer.id !== id);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (e.repeat) return;

      const layers = [...layersRef.current].sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.order - a.order; // most recently registered wins
      });
      if (layers.length === 0) return;

      e.preventDefault();
      e.stopPropagation();
      layers[0].onEscape();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  return (
    <EscapeStackContext.Provider value={{ register, unregister }}>
      {children}
    </EscapeStackContext.Provider>
  );
};

/**
 * Register an Escape handler while `enabled` is true.
 * Highest priority open layer wins.
 */
export function useEscapeLayer(
  id: string,
  onEscape: () => void,
  enabled: boolean,
  priority: number = ESCAPE_PRIORITY.modal
) {
  const ctx = useContext(EscapeStackContext);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!ctx || !enabled) return;
    const handler = () => onEscapeRef.current();
    ctx.register(id, handler, priority);
    return () => ctx.unregister(id);
  }, [ctx, enabled, id, priority]);
}
