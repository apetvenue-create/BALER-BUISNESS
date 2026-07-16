
import { AuthSession } from './auth.contract';
import { supabase, clearCachedUser } from '../services/supabase';

const friendlyAuthError = (message: string): string => {
  const lower = (message || '').toLowerCase();
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many requests. Please wait a few seconds and try again.';
  }
  return message || 'Authentication failed';
};

export const AuthService = {
  async signIn(email: string, pass: string): Promise<AuthSession> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) throw new Error(friendlyAuthError(error.message));
    if (!data.session || !data.user) throw new Error("No session created");

    clearCachedUser();
    return this._mapSession(data.user);
  },

  async signUp(email: string, pass: string, name: string): Promise<AuthSession> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: { name }, // Store business name in metadata
      },
    });

    if (error) throw new Error(friendlyAuthError(error.message));
    
    // Check if session exists (Supabase might require email confirmation)
    if (!data.session && data.user) {
        throw new Error("Account created! Please check your email to confirm registration.");
    }
    
    if (!data.user || !data.session) throw new Error("Registration failed");

    clearCachedUser();
    return this._mapSession(data.user);
  },

  async signOut(): Promise<void> {
    clearCachedUser();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async restoreSession(): Promise<AuthSession | null> {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session || !session.user) return null;
    return this._mapSession(session.user);
  },

  // Helper to map Supabase User to our App's AuthSession
  _mapSession(user: any): AuthSession {
    return {
      userId: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.email?.split('@')[0],
      issuedAt: Date.now(),
    };
  }
};
