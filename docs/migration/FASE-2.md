# Fase 2 — Extração de infraestrutura e Categorias

## Regra de paridade
- Nenhum HTML alterado.
- Nenhum CSS alterado.
- Nenhuma função visual removida.
- O banco continua usando as mesmas tabelas e políticas atuais.

## Dependências extraídas

`admin-v2.js`
→ `core/supabase-client.js`
→ `core/admin-auth-service.js`
→ `features/categories/categories-repository.js`

## Motivo

A meta é retirar chamadas diretas ao backend do arquivo de interface antes da conversão para Next.js. Isso separa três responsabilidades que hoje estão misturadas:

1. Interface e eventos DOM;
2. regras de negócio;
3. persistência/serviços externos.

Cloudinary, Upstash e PostHog permanecem reservados para depois da paridade funcional.
