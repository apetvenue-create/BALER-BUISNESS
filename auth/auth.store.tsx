
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthState, AuthContextType } from './auth.contract';
import { AuthService } from './auth.service';
import { supabase } from '../services/supabase';

const initialContext: AuthContextType = {
  session: null,
  loading: true,
  error: null,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
};

const AuthContext = createContext<AuthContextType>(initialContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    session: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // App Bootstrap: Restore session
    const initAuth = async () => {
      try {
        const session = await AuthService.restoreSession();
        setState(prev => ({ ...prev, session, loading: false }));
      } catch (e) {
        setState(prev => ({ ...prev, session: null, loading: false }));
      }
    };
    initAuth();

    // Listen for Supabase auth changes (e.g. token refresh, logout from other tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setState({ session: null, loading: false, error: null });
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const mappedSession = await AuthService.restoreSession();
        setState({ session: mappedSession, loading: false, error: null });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const session = await AuthService.signIn(email, pass);
      setState({ session, loading: false, error: null });
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Authentication failed',
      }));
      throw err;
    }
  };

  const signUp = async (email: string, pass: string, name: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const session = await AuthService.signUp(email, pass, name);
      setState({ session, loading: false, error: null });
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Registration failed',
      }));
      throw err;
    }
  };

  const signOut = async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      await AuthService.signOut();
      setState({ session: null, loading: false, error: null });
    } catch (e) {
        // Force logout on error
        setState({ session: null, loading: false, error: null });
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
