import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const routes = ['app/page.tsx','app/inicio/page.tsx','app/galeria/page.tsx','app/sobre/page.tsx','app/contato/page.tsx','app/area-cliente/page.tsx','app/admin/page.tsx'];
const legacy = ['index.html','galeria.html','sobre.html','contato.html','area-cliente.html','admin-v2.html'];
for (const file of [...routes, ...legacy.map(file => `public/legacy/${file}`)]) await access(resolve(root,file));
for (const file of ['app/page.tsx','app/galeria/page.tsx','app/sobre/page.tsx','app/contato/page.tsx']) {
  const source = await readFile(resolve(root,file),'utf8');
  if (source.includes('LegacyPage')) throw new Error(`${file} ainda usa a ponte legada`);
}
const hashes = {};
for (const file of legacy) {
  const data = await readFile(resolve(root,'public/legacy',file));
  hashes[file] = createHash('sha256').update(data).digest('hex');
}
console.log(JSON.stringify({routes:routes.length,nativePages:4,legacyPages:legacy.length,hashes},null,2));
