# Implantação segura

## Gates obrigatórios

1. Usar Node.js 20.9 ou superior.
2. Na primeira validação, executar `npm install`, `npm run typecheck` e `npm run build`. Depois que o `package-lock.json` for criado e guardado, os ambientes seguintes devem usar `npm ci`.
3. Preencher `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no ambiente de preview.
4. Manter `SUPABASE_SERVICE_ROLE_KEY` somente no servidor e apenas se alguma futura rota realmente precisar dela.
5. Abrir `/api/health` e confirmar `ok: true` e `configured: true`.
6. Executar smoke tests das rotas `/`, `/galeria`, `/sobre`, `/contato`, `/area-cliente` e `/admin`.
7. Testar login do Admin, upload, capa, ordenação, criação/exclusão de Ensaio, seleção e entrega no preview.
8. Comparar desktop e mobile com o site atual.
9. Só promover o preview depois de aprovação explícita.

## Estratégia

Publicar primeiro como projeto/URL de preview independente. Não apontar domínio nem substituir o repositório de produção durante a validação. Admin e Área do Cliente permanecem na ponte legada e continuam protegidos por Supabase Auth/RLS.

## Variáveis futuras

Cloudinary, Upstash e PostHog continuam opcionais e não devem ser ativados antes de seus fluxos e políticas estarem implementados e testados.
