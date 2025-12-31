
export interface AuthSession {
  userId: string;
  email: string;
  name?: string;
  issuedAt: number;
}

export interface AuthState {
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}
