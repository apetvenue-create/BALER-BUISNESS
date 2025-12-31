
import { AuthSession } from '../auth/auth.contract';

const STORAGE_KEY = 'tm_auth_session_v1';

export const SessionStorage = {
  save(session: AuthSession): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      console.error('Critical: Failed to save auth session', e);
    }
  },

  load(): AuthSession | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored) as AuthSession;
    } catch (e) {
      console.error('Critical: Failed to load auth session', e);
      return null;
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Critical: Failed to clear auth session', e);
    }
  }
};
