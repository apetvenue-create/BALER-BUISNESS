import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ESCAPE_PRIORITY, useEscapeLayer } from './EscapeStack';
import { playCancelSound, playConfirmSound } from './UiSoundProvider';

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

const ConfirmContext = createContext<ConfirmFn | null>(null);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const close = useCallback((value: boolean) => {
    if (value) playConfirmSound();
    else playCancelSound();
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  useEscapeLayer(
    'confirm-dialog',
    () => close(false),
    !!pending,
    ESCAPE_PRIORITY.confirm
  );

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) close(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="w-full max-w-[20rem] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
          >
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              </span>
              <div className="min-w-0">
                <h2 id="confirm-dialog-title" className="text-sm font-bold text-slate-900">
                  {pending.title || 'Confirm'}
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  {pending.message}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                data-ui-sound-off
                onClick={() => close(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                {pending.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                data-ui-sound-off
                onClick={() => close(true)}
                className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
              >
                {pending.confirmLabel || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return context;
}
