
import { supabase } from './supabase';

export const SettingsService = {
  async get(key: string): Promise<any> {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle(); // Changed from single() to maybeSingle() to avoid PGRST116 error
    
    if (error) {
      console.warn(`Settings load warning for ${key}:`, error.message);
      return null;
    }

    return data ? data.value : null;
  },

  async set(key: string, value: any): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    
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
