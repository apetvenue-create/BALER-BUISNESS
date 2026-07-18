import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { playUiSound, uiSound, type UiSoundKind } from '../services/uiSound';

type UiSoundApi = {
  play: (kind: UiSoundKind) => void;
  muted: boolean;
  setMuted: (value: boolean) => void;
  toggleMuted: () => void;
};

const UiSoundContext = createContext<UiSoundApi | null>(null);

function isInteractiveTarget(el: Element | null): Element | null {
  if (!el) return null;
  return el.closest(
    [
      'button',
      'a[href]',
      '[role="button"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[role="option"]',
      '[role="switch"]',
      'summary',
      'label',
      'select',
      'input[type="checkbox"]',
      'input[type="radio"]',
      'input[type="submit"]',
      'input[type="button"]',
      '[data-ui-sound]',
    ].join(',')
  );
}

function soundKindForElement(el: Element): UiSoundKind {
  const explicit = el.getAttribute('data-ui-sound') as UiSoundKind | null;
  if (
    explicit === 'tap' ||
    explicit === 'select' ||
    explicit === 'success' ||
    explicit === 'error' ||
    explicit === 'confirm' ||
    explicit === 'cancel'
  ) {
    return explicit;
  }

  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role');
  const type = (el as HTMLInputElement).type?.toLowerCase?.();

  if (
    tag === 'select' ||
    type === 'checkbox' ||
    type === 'radio' ||
    role === 'tab' ||
    role === 'option' ||
    role === 'switch' ||
    role === 'menuitem'
  ) {
    return 'select';
  }

  return 'tap';
}

function shouldSkipSound(el: Element): boolean {
  if (el.closest('[data-ui-sound-off]')) return true;
  if ((el as HTMLButtonElement).disabled) return true;
  if ((el as HTMLInputElement).disabled) return true;
  if (el.getAttribute('aria-disabled') === 'true') return true;
  return false;
}

export const UiSoundProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [muted, setMutedState] = useState(() => uiSound.isMuted());

  const setMuted = useCallback((value: boolean) => {
    uiSound.setMuted(value);
    setMutedState(value);
  }, []);

  const toggleMuted = useCallback(() => {
    const next = uiSound.toggleMuted();
    setMutedState(next);
    return next;
  }, []);

  const play = useCallback((kind: UiSoundKind) => {
    playUiSound(kind);
  }, []);

  // Unlock audio on first user gesture anywhere in the app
  useEffect(() => {
    const unlock = () => uiSound.unlock();
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
  }, []);

  // Global soft sounds for buttons, tabs, selects, checkboxes
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as Element | null;
      const interactive = isInteractiveTarget(target);
      if (!interactive || shouldSkipSound(interactive)) return;
      // Selects fire a cleaner sound on `change` (covers keyboard too)
      if (interactive.tagName.toLowerCase() === 'select') return;
      playUiSound(soundKindForElement(interactive));
    };

    const onChange = (e: Event) => {
      const target = e.target as Element | null;
      if (!target || shouldSkipSound(target)) return;
      const tag = target.tagName.toLowerCase();
      const type = (target as HTMLInputElement).type?.toLowerCase?.();
      if (tag === 'select') {
        playUiSound('select');
        return;
      }
      // Keyboard activation of checkbox/radio (pointer already handled)
      if ((type === 'checkbox' || type === 'radio') && (e as InputEvent).isTrusted) {
        // Avoid duplicate after pointerdown: only when focus came from keyboard is hard;
        // rate-limit in engine handles rapid duplicates.
      }
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('change', onChange, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('change', onChange, true);
    };
  }, []);

  const value = useMemo(
    () => ({
      play,
      muted,
      setMuted,
      toggleMuted: () => {
        toggleMuted();
      },
    }),
    [play, muted, setMuted, toggleMuted]
  );

  return <UiSoundContext.Provider value={value}>{children}</UiSoundContext.Provider>;
};

export function useUiSound(): UiSoundApi {
  const ctx = useContext(UiSoundContext);
  if (!ctx) {
    // Safe fallback when used outside provider (tests / partial trees)
    return {
      play: playUiSound,
      muted: uiSound.isMuted(),
      setMuted: (v) => uiSound.setMuted(v),
      toggleMuted: () => {
        uiSound.toggleMuted();
      },
    };
  }
  return ctx;
}

/** Imperative helpers for non-React call sites */
export const playSuccessSound = () => playUiSound('success');
export const playErrorSound = () => playUiSound('error');
export const playConfirmSound = () => playUiSound('confirm');
export const playCancelSound = () => playUiSound('cancel');
