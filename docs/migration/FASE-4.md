# Fase 4 — Infraestrutura fora do Admin principal

Objetivo: garantir que `admin-v2.js` deixe de acessar Supabase diretamente.

## Extraído

- Dashboard → `features/dashboard/dashboard-repository.js`
- CMS → `features/cms/site-content-repository.js`
- Configurações → `features/cms/site-settings-repository.js`
- Realtime → `features/realtime/admin-realtime-service.js`
- Edge Functions → `features/notifications/notifications-service.js`
- Auth state → `core/admin-auth-service.js`
- Hero/Área do Cliente uploads → `core/storage-service.js`

## Regra de paridade

Nenhuma alteração visual ou de fluxo foi introduzida. Os novos módulos preservam tabelas, Edge Functions, buckets e nomes de campos já usados pelo sistema atual.
