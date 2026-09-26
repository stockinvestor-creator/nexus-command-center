import { supabase } from '@/lib/supabase';
import type { Backend } from './types';
import { SupabaseBackend } from './supabaseBackend';
import { LocalBackend } from './localBackend';

export type { Backend, ChangeEvent, QueryOptions, PresenceUser, RealtimeRoom, AuthUser, TypingEvent } from './types';
export { LocalBackend } from './localBackend';
export { DEMO_USERS } from './localSeed';

/** The single data backend for the app. Supabase when configured, otherwise local Demo Mode. */
export const backend: Backend = supabase ? new SupabaseBackend(supabase) : new LocalBackend();

export const isDemoMode = backend.mode === 'local';
