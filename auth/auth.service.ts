
import { AuthSession } from './auth.contract';
import { SessionStorage } from '../storage/session.storage';

// This service mimics a real backend API client.
// It can be replaced with Supabase/Firebase client later without breaking the app.
export const AuthService = {
  async signIn(email: string, _pass: string): Promise<AuthSession> {
    // Simulate network latency (300-800ms)
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));

    // Basic validation (Simulate backend validation)
    if (!email || !email.includes('@')) {
      throw new Error("Invalid email format");
    }
    if (!_pass || _pass.length < 3) {
        throw new Error("Password too short");
    }

    // Generate simulated session
    const session: AuthSession = {
      userId: 'user_' + Math.random().toString(36).substring(2, 9),
      email: email.toLowerCase(),
      name: email.split('@')[0],
      issuedAt: Date.now(),
    };

    // Persist via storage adapter
    SessionStorage.save(session);
    
    return session;
  },

  async signUp(email: string, _pass: string, name: string): Promise<AuthSession> {
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 500));

    // Backend Validation
    if (!name || name.trim().length === 0) throw new Error("Business name is required");
    if (!email || !email.includes('@')) throw new Error("Invalid email address");
    if (!_pass || _pass.length < 6) throw new Error("Password must be at least 6 characters");

    const session: AuthSession = {
      userId: 'user_' + Math.random().toString(36).substring(2, 9),
      email: email.toLowerCase(),
      name: name.trim(),
      issuedAt: Date.now(),
    };

    SessionStorage.save(session);
    return session;
  },

  async signOut(): Promise<void> {
    // Simulate network
    await new Promise(resolve => setTimeout(resolve, 200));
    SessionStorage.clear();
  },

  // Synchronous restoration from storage (for fast app boot)
  restoreSession(): AuthSession | null {
    return SessionStorage.load();
  }
};
