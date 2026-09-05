# Correção pós-Fase 68 — abertura imediata da Galeria

Esta correção reativa a pré-carga completa das páginas públicas no menu do Next.js e transforma o conteúdo público em páginas pré-renderizadas, atualizadas automaticamente a cada 30 segundos.

Resultado esperado: ao clicar em **Galeria** a partir de **Início**, trilhas, categorias e ensaios já estarão preparados antes da navegação, evitando que os textos apareçam primeiro e que “Nenhum ensaio encontrado” seja exibido temporariamente.

A pré-renderização utiliza somente dados públicos. Login, ensaios privados e dados de clientes não são armazenados nela. Também foram incluídos arquivos `.gitignore` para impedir o envio acidental de arquivos de ambiente ao GitHub.

Arquivo alterado:

- `next-app/components/public-nav.tsx`
- `next-app/lib/public-gallery.ts`
- `next-app/lib/site-content.ts`
- `next-app/lib/published-design.ts`
- `next-app/lib/supabase/public.ts`
- `next-app/app/galeria/page.tsx`
- `.gitignore`
- `next-app/.gitignore`

Validações executadas:

- `npm run typecheck`
- `npm run build`
