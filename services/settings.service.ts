
import { supabase } from './supabase';

const LOCAL_SETTINGS_PREFIX = 'app_settings_fallback_v1';

const buildLocalKey = (key: string, userId?: string) =>
  `${LOCAL_SETTINGS_PREFIX}:${userId || 'anon'}:${key}`;

const readLocalFallback = (key: string, userId?: string): any => {
  try {
    const raw = localStorage.getItem(buildLocalKey(key, userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeLocalFallback = (key: string, userId: string | undefined, value: any): void => {
  try {
    localStorage.setItem(buildLocalKey(key, userId), JSON.stringify(value));
  } catch {
    // Ignore localStorage failures (quota/private mode).
  }
};

export const SettingsService = {
  async get(key: string): Promise<any> {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return readLocalFallback(key);

    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('user_id', user.id)
      .eq('key', key)
      .maybeSingle();
    
    if (error) {
      console.warn(`Settings load warning for ${key}:`, error.message);
      return readLocalFallback(key, user.id);
    }

    if (data && data.value !== undefined) {
      writeLocalFallback(key, user.id, data.value);
      return data.value;
    }

    return readLocalFallback(key, user.id);
  },

  async set(key: string, value: any): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    // Persist locally first to prevent data loss during transient auth/network failures.
    writeLocalFallback(key, user?.id, value);
    
    if (!user) return;

    const { error } = await supabase
      .from('app_settings')
      .upsert({ 
        user_id: user.id, 
        key, 
        value 
      }, { onConflict: 'user_id, key' });

    if (error) console.error('Settings save failed', error);
  }
};
