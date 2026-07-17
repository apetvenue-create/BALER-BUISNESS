import { createClient } from '@supabase/supabase-js';

const PROJECT_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const API_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  PROJECT_URL &&
    API_KEY &&
    !PROJECT_URL.includes('placeholder.supabase.co')
);

if (!isSupabaseConfigured) {
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in Vercel Project Settings → Environment Variables, then redeploy.'
  );
}

const REQUEST_TIMEOUT_MS = 12_000;

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

const isAuthRequest = (input: URL | RequestInfo): boolean => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  return /\/auth\/v1\//i.test(url);
};

const fetchWithTimeout = async (
  input: URL | RequestInfo,
  init?: RequestInit
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const parentSignal = init?.signal;
    if (parentSignal) {
      if (parentSignal.aborted) {
        controller.abort();
      } else {
        parentSignal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }

    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Custom fetch for Supabase.
 * Native fetch only throws on network failure — HTTP error statuses must be
 * returned so supabase-js can read the body. We only retry transient failures.
 */
const retryFetch = async (
  input: URL | RequestInfo,
  init?: RequestInit,
  retries = 2,
  delay = 800
): Promise<Response> => {
  const authCall = isAuthRequest(input);
  // Auth should fail fast on production so the UI doesn't spin forever.
  const maxRetries = authCall ? Math.min(retries, 2) : retries;
  const waitBase = authCall ? Math.min(delay, 400) : delay;

  try {
    const response = await fetchWithTimeout(input, init);

    if ((response.status === 429 || response.status === 503) && maxRetries > 0) {
      const waitMs = authCall
        ? Math.min(parseRetryAfterMs(response, waitBase), 1000)
        : parseRetryAfterMs(response, waitBase);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return retryFetch(input, init, maxRetries - 1, Math.min(waitBase * 2, authCall ? 1200 : 8000));
    }

    if (response.status === 401 || response.status === 403) {
      cachedUser = null;
      pendingUserPromise = null;
      userCacheTimestamp = 0;
    }

    return response;
  } catch (error) {
    if (maxRetries > 0) {
      await new Promise(resolve => setTimeout(resolve, waitBase));
      return retryFetch(input, init, maxRetries - 1, Math.min(waitBase * 2, authCall ? 1200 : 8000));
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.');
    }

    throw error;
  }
};

export const supabase = createClient(
  PROJECT_URL || 'https://placeholder.supabase.co',
  API_KEY || 'placeholder',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: retryFetch,
    },
  }
);

let cachedUser: any = null;
let userCacheTimestamp = 0;
const USER_CACHE_TTL = 60_000;
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
