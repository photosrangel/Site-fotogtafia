import { access,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const required=['package.json','next.config.ts','.env.example','app/api/health/route.ts','app/admin/page.tsx','app/area-cliente/page.tsx','artifacts/build-status.json','DEPLOYMENT.md','ROLLBACK.md'];
for(const file of required)await access(resolve(root,file));
const env=await readFile(resolve(root,'.env.example'),'utf8');
for(const name of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY'])if(!env.includes(`${name}=`))throw new Error(`Variável ausente no exemplo: ${name}`);
for(const route of ['app/admin/page.tsx','app/area-cliente/page.tsx']){const source=await readFile(resolve(root,route),'utf8');if(!source.includes('index:false')||!source.includes('follow:false'))throw new Error(`${route} sem noindex/nofollow`)}
const config=await readFile(resolve(root,'next.config.ts'),'utf8');for(const header of ['Content-Security-Policy','X-Content-Type-Options','Referrer-Policy','Permissions-Policy'])if(!config.includes(header))throw new Error(`Cabeçalho ausente: ${header}`);
const status=JSON.parse(await readFile(resolve(root,'artifacts/build-status.json'),'utf8'));
const report={structure:true,environmentContract:true,protectedMetadata:true,securityHeaders:true,build:status};console.log(JSON.stringify(report,null,2));
if(!status.verified&&!process.argv.includes('--allow-blocked'))process.exitCode=2;
