// Camada de autenticação do Admin.
// Não contém DOM nem regras visuais: apenas conversa com o Supabase Auth.
import { supabase } from './supabase-client.js';

export async function getAdminSession() {
  return supabase.auth.getSession();
}

export async function signInAdmin(email, password) {
  const guard = await supabase.functions.invoke('admin-login-guard', { body: { emailHint: String(email || '').slice(-32) } });
  if (guard.data?.rate_limited) return { data: { session: null }, error: new Error('rate_limited') };
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInAdminWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}/admin` }
  });
}

export async function listAdminFactors() {
  return supabase.auth.mfa.listFactors();
}

export async function enrollAdminTotp() {
  return supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Painel Rangel Santos' });
}

export async function verifyAdminTotp(factorId, code) {
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) return challenge;
  return supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
}

export async function getAdminAssuranceLevel() {
  return supabase.auth.mfa.getAuthenticatorAssuranceLevel();
}

export async function signOutAdmin() {
  return supabase.auth.signOut();
}

export function onAdminAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}
