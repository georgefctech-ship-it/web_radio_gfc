import { supabase } from './supabase';

export const LIVE_SESSION_ID = 'global';

export interface LiveSessionState {
  id: string;
  is_live: boolean;
  broadcaster_name: string | null;
  started_at: string | null;
  updated_at: string | null;
}

export const DEFAULT_BROADCASTER_NAME = 'George Ferreira';

export async function fetchLiveSessionState(): Promise<LiveSessionState | null> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select('*')
    .eq('id', LIVE_SESSION_ID)
    .maybeSingle();

  if (error) {
    console.warn('[LiveSession] Failed to fetch current live state:', error.message);
    return null;
  }

  return data;
}

export async function updateLiveSessionState(isLive: boolean, broadcasterName = DEFAULT_BROADCASTER_NAME) {
  const payload = {
    id: LIVE_SESSION_ID,
    is_live: isLive,
    broadcaster_name: isLive ? broadcasterName : null,
    started_at: isLive ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('live_sessions').upsert(payload, { onConflict: 'id' });

  if (error) {
    console.warn('[LiveSession] Failed to sync live state:', error.message);
    throw error;
  }
}
