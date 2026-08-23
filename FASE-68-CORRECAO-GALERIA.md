# Correção pós-Fase 68 — abertura imediata da Galeria

Esta correção reativa a pré-carga completa das páginas públicas no menu do Next.js e mantém os dados públicos da galeria em uma memória temporária de 30 segundos.

Resultado esperado: ao clicar em **Galeria** a partir de **Início**, trilhas, categorias e ensaios já estarão preparados antes da navegação, evitando que os textos apareçam primeiro e que “Nenhum ensaio encontrado” seja exibido temporariamente.

A memória temporária utiliza somente dados públicos. Login, ensaios privados e dados de clientes não são armazenados nela.

Arquivo alterado:

- `next-app/components/public-nav.tsx`
- `next-app/lib/public-gallery.ts`

Validações executadas:

- `npm run typecheck`
- `npm run build`
