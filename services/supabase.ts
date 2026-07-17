
import { createClient } from '@supabase/supabase-js';

const PROJECT_URL = import.meta.env.VITE_SUPABASE_URL || '';
const API_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!PROJECT_URL || !API_KEY) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
}

const parseRetryAfterMs = (response: Response, fallbackMs: number): number => {
  const header = response.headers.get('Retry-After');
  if (!header) return fallbackMs;

  const asSeconds = Number(header);
  if (!Number.isNaN(asSeconds) && asSeconds >= 0) {
    return Math.max(asSeconds * 1000, fallbackMs);
  }

  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) {
    return Math.max(asDate - Date.now(), fallbackMs);
  }

  return fallbackMs;
};

/**
 * Custom fetch for Supabase.
 * Native fetch only throws on network failure — HTTP error statuses must be
 * returned so supabase-js can read the body. We only retry transient failures.
 */
const isAuthRequest = (input: URL | RequestInfo): boolean => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  return /\/auth\/v1\//i.test(url);
};

const retryFetch = async (
  input: URL | RequestInfo,
  init?: RequestInit,
  retries = 3,
  delay = 1500
): Promise<Response> => {
  // Auth: keep retrying quietly so users can attempt unlimited times.
  const authCall = isAuthRequest(input);
  const maxRetries = authCall ? Math.max(retries, 8) : retries;
  const waitBase = authCall ? Math.min(delay, 300) : delay;

  try {
    const response = await fetch(input, init);

    // Rate limited / temporarily unavailable — wait briefly, then retry (no user-facing block)
    if ((response.status === 429 || response.status === 503) && maxRetries > 0) {
      const waitMs = authCall
        ? Math.min(parseRetryAfterMs(response, waitBase), 800)
        : parseRetryAfterMs(response, waitBase);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return retryFetch(input, init, maxRetries - 1, Math.min(waitBase * 2, authCall ? 1000 : 15000));
    }

    if (response.status === 401 || response.status === 403) {
      // Clear local user cache only — do NOT signOut here (avoids fetch loops)
      cachedUser = null;
      pendingUserPromise = null;
      userCacheTimestamp = 0;
    }

    // Always return the Response (including 4xx/5xx) for supabase-js to handle
    return response;
  } catch (error) {
    // Network / CORS failures only — keep retrying auth quietly
    if (maxRetries > 0) {
      await new Promise(resolve => setTimeout(resolve, waitBase));
      return retryFetch(input, init, maxRetries - 1, Math.min(waitBase * 2, authCall ? 1000 : 15000));
    }
    throw error;
  }
};

export const supabase = createClient(PROJECT_URL || 'https://placeholder.supabase.co', API_KEY || 'placeholder', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: retryFetch,
  },
});

// Cache user to avoid multiple auth lookups in parallel
let cachedUser: any = null;
let userCacheTimestamp = 0;
const USER_CACHE_TTL = 60_000; // 60 seconds — JWT is valid much longer
let pendingUserPromise: Promise<any> | null = null;

/**
 * Returns the current user from the local session (no Auth API round-trip).
 * Avoids getUser() which hits Supabase Auth on every call and triggers 429s.
 */
export const getCachedUser = async () => {
  const now = Date.now();
  if (cachedUser && now - userCacheTimestamp < USER_CACHE_TTL) {
    return cachedUser;
  }

  if (pendingUserPromise) {
    return pendingUserPromise;
  }

  pendingUserPromise = (async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) {
        cachedUser = null;
        userCacheTimestamp = 0;
        return null;
      }
      cachedUser = session.user;
      userCacheTimestamp = Date.now();
      return cachedUser;
    } catch (err) {
      // Transient errors: keep existing cache if present; never sign out here
      console.warn('getCachedUser failed:', err);
      return cachedUser;
    } finally {
      pendingUserPromise = null;
    }
  })();

  return pendingUserPromise;
};

/** Clear cached user (e.g. after explicit logout). */
export const clearCachedUser = () => {
  cachedUser = null;
  userCacheTimestamp = 0;
  pendingUserPromise = null;
};
