
export interface AuthSession {
  userId: string;
  email: string;
  name?: string;
  issuedAt: number;
}

export interface SignUpResult {
  session: AuthSession;
  email: string;
}

export interface AuthState {
  session: AuthSession | null;
  /** True only while restoring an existing session on first app load */
  loading: boolean;
  /** True while Sign In / Sign Up request is in flight */
  submitting: boolean;
  error: string | null;
  notice: string | null;
}

export interface AuthContextType extends AuthState {
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  clearMessages: () => void;
}
