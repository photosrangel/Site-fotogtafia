// Camada de autenticação do Admin.
// Não contém DOM nem regras visuais: apenas conversa com o Supabase Auth.
import { supabase } from './supabase-client.js';

export async function getAdminSession() {
  return supabase.auth.getSession();
}

export async function signInAdmin(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOutAdmin() {
  return supabase.auth.signOut();
}

export function onAdminAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}
