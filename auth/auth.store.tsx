import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthState, AuthContextType } from './auth.contract';
import { AuthService } from './auth.service';
import { supabase } from '../services/supabase';

const initialContext: AuthContextType = {
  session: null,
  loading: true,
  submitting: false,
  error: null,
  notice: null,
  signIn: async () => {},
  signUp: async () => ({
    session: { userId: '', email: '', issuedAt: 0 },
    email: '',
  }),
  signOut: async () => {},
  clearMessages: () => {},
};

const AuthContext = createContext<AuthContextType>(initialContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    session: null,
    loading: true,
    submitting: false,
    error: null,
    notice: null,
  });

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const session = await Promise.race([
          AuthService.restoreSession(),
          new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), 8000);
          }),
        ]);
        if (mounted) {
          setState(prev => ({
            ...prev,
            session,
            loading: false,
            submitting: false,
          }));
        }
      } catch {
        if (mounted) {
          setState(prev => ({
            ...prev,
            session: null,
            loading: false,
            submitting: false,
          }));
        }
      }
    };

    void initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setState(prev => ({
          ...prev,
          session: null,
          loading: false,
          submitting: false,
          error: null,
          notice: null,
        }));
        return;
      }

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        const mappedSession = AuthService._mapSession(session.user);
        setState(prev => ({
          ...prev,
          session: mappedSession,
          loading: false,
          submitting: false,
          error: null,
          notice: null,
        }));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    setState(prev => ({ ...prev, submitting: true, error: null, notice: null }));
    try {
      const session = await AuthService.signIn(email, pass);
      setState(prev => ({
        ...prev,
        session,
        loading: false,
        submitting: false,
        error: null,
        notice: null,
      }));
    } catch (err: any) {
      const raw = (err?.message || '').trim();
      setState(prev => ({
        ...prev,
        submitting: false,
        error: raw || null,
        notice: null,
      }));
      throw err;
    }
  };

  const signUp = async (email: string, pass: string, name: string) => {
    setState(prev => ({ ...prev, submitting: true, error: null, notice: null }));
    try {
      const result = await AuthService.signUp(email, pass, name);
      setState(prev => ({
        ...prev,
        session: result.session,
        loading: false,
        submitting: false,
        error: null,
        notice: null,
      }));
      return result;
    } catch (err: any) {
      const raw = (err?.message || '').trim();
      setState(prev => ({
        ...prev,
        submitting: false,
        error: raw || null,
        notice: null,
      }));
      throw err;
    }
  };

  const signOut = async () => {
    setState({
      session: null,
      loading: false,
      submitting: false,
      error: null,
      notice: null,
    });

    try {
      await AuthService.signOut();
    } catch (e) {
      console.error('Background logout error', e);
    }
  };

  const clearMessages = () => {
    setState(prev => ({ ...prev, error: null, notice: null }));
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signOut, clearMessages }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
