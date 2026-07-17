
import { AuthSession, SignUpResult } from './auth.contract';
import { supabase, clearCachedUser, isSupabaseConfigured } from '../services/supabase';

const CONFIG_ERROR =
  'App is not connected to Supabase. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, then redeploy.';

const assertConfigured = () => {
  if (!isSupabaseConfigured) {
    throw new Error(CONFIG_ERROR);
  }
};

const friendlyAuthError = (message: string): string => {
  const lower = (message || '').toLowerCase();
  // Ignore rate-limit / wait messages so the user can retry freely.
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too many')) {
    return '';
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('timed out') || lower.includes('timeout')) {
    return 'Could not reach the server. Check your internet connection and try again.';
  }
  if (lower.includes('email not confirmed') || lower.includes('confirm')) {
    return 'Email confirmation is still enabled in Supabase. Turn OFF "Confirm email" under Authentication → Providers → Email, then sign up again for instant access.';
  }
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return 'Invalid email or password.';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  return message || 'Authentication failed';
};

export const AuthService = {
  async signIn(email: string, pass: string): Promise<AuthSession> {
    assertConfigured();
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: pass,
    });

    if (error) {
      const msg = friendlyAuthError(error.message);
      if (msg) throw new Error(msg);
      // Rate-limit noise: allow another immediate attempt without a blocking alert.
      throw new Error('');
    }
    if (!data.session || !data.user) throw new Error('No session created');

    clearCachedUser();
    return this._mapSession(data.user);
  },

  /**
   * Creates the Auth user and always returns an active session so the app
   * opens immediately after signup. Requires Supabase "Confirm email" OFF.
   */
  async signUp(email: string, pass: string, name: string): Promise<SignUpResult> {
    assertConfigured();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: pass,
      options: {
        data: { name: normalizedName },
      },
    });

    if (error) {
      const msg = friendlyAuthError(error.message);
      if (msg) throw new Error(msg);
      throw new Error('');
    }
    if (!data.user) throw new Error('Registration failed. Please try again.');

    // Existing email obfuscation response from Supabase
    if (!data.session && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    // Preferred path: project returns a session immediately (Confirm email OFF)
    if (data.session?.user) {
      clearCachedUser();
      return {
        session: this._mapSession(data.session.user),
        email: normalizedEmail,
      };
    }

    // Fallback: force login so the app opens instantly after signup
    try {
      const session = await this.signIn(normalizedEmail, pass);
      return { session, email: normalizedEmail };
    } catch (err: any) {
      throw new Error(
        friendlyAuthError(
          err?.message ||
            'Could not open the app after signup. In Supabase Dashboard → Authentication → Providers → Email, turn OFF "Confirm email", then try again.'
        )
      );
    }
  },

  async signOut(): Promise<void> {
    clearCachedUser();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async restoreSession(): Promise<AuthSession | null> {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session || !session.user) return null;
    clearCachedUser();
    return this._mapSession(session.user);
  },

  _mapSession(user: any): AuthSession {
    return {
      userId: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.email?.split('@')[0],
      issuedAt: Date.now(),
    };
  },
};
