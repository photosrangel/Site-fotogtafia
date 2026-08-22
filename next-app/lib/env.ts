const requiredPublic=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] as const;
export function validatePublicEnvironment(){const missing=requiredPublic.filter(name=>!process.env[name]);if(missing.length)throw new Error(`Variáveis obrigatórias ausentes: ${missing.join(', ')}`);return {supabaseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL!,supabasePublishableKey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!}}
export function hasServerRoleKey(){return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
