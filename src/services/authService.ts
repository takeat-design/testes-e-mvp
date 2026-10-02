import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

function requireClient() {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}

export const authService = {
  async getSession(): Promise<Session | null> {
    const client = requireClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw new Error(error.message);
    return data.session;
  },

  async signIn(email: string, password: string): Promise<Session> {
    const client = requireClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('Não foi possível iniciar a sessão.');
    return data.session;
  },

  async hasWorkspaceAccess(userId: string): Promise<boolean> {
    const client = requireClient();
    const { data, error } = await client
      .from('workspace_members')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data);
  },

  async signOut(): Promise<void> {
    const { error } = await requireClient().auth.signOut();
    if (error) throw new Error(error.message);
  },
};
