# Correção pós-Fase 68 — abertura imediata da Galeria

Esta correção reativa a pré-carga completa das páginas públicas no menu do Next.js.

Resultado esperado: ao clicar em **Galeria** a partir de **Início**, trilhas, categorias e ensaios já estarão preparados antes da navegação, evitando a exibição temporária de “Nenhum ensaio encontrado”.

Arquivo alterado:

- `next-app/components/public-nav.tsx`

Validações executadas:

- `npm run typecheck`
- `npm run build`
