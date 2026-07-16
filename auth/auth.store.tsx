import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthState, AuthContextType } from './auth.contract';
import { AuthService } from './auth.service';
import { supabase } from '../services/supabase';

const initialContext: AuthContextType = {
  session: null,
  loading: true, // Initial load is true
  error: null,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
};

const AuthContext = createContext<AuthContextType>(initialContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    session: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    // App Bootstrap: Restore session
    const initAuth = async () => {
      try {
        const session = await AuthService.restoreSession();
        if (mounted) setState(prev => ({ ...prev, session, loading: false }));
      } catch (e) {
        if (mounted) setState(prev => ({ ...prev, session: null, loading: false }));
      }
    };
    initAuth();

    // Listen for Supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (event === 'SIGNED_OUT') {
        setState({ session: null, loading: false, error: null });
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Optimization: Use the session object from the event if compatible, 
        // otherwise verify with service.
        if (session && session.user) {
             const mappedSession = AuthService._mapSession(session.user);
             setState({ session: mappedSession, loading: false, error: null });
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const session = await AuthService.signIn(email, pass);
      setState({ session, loading: false, error: null });
    } catch (err: any) {
      const raw = err?.message || 'Authentication failed';
      const friendly =
        /429|rate limit|too many|http error/i.test(raw)
          ? 'Too many requests. Please wait a few seconds and try again.'
          : raw;
      setState(prev => ({
        ...prev,
        loading: false,
        error: friendly,
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
      const raw = err?.message || 'Registration failed';
      const friendly =
        /429|rate limit|too many|http error/i.test(raw)
          ? 'Too many requests. Please wait a few seconds and try again.'
          : raw;
      setState(prev => ({
        ...prev,
        loading: false,
        error: friendly,
      }));
      throw err;
    }
  };

  const signOut = async () => {
    // 1. Instant UI Update
    setState({ session: null, loading: false, error: null });
    
    // 2. Background cleanup
    try {
      await AuthService.signOut();
    } catch (e) {
      console.error("Background logout error", e);
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