// Cliente Supabase único para o painel administrativo.
// Centralizar a criação do cliente evita instâncias duplicadas e deixa
// a troca futura para @supabase/ssr/Next.js localizada em um único módulo.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase-config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
