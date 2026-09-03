# Matriz de paridade Next.js

| Superfície atual | Rota Next.js | Estado na Fase 9 |
|---|---|---|
| Início (`index.html`) | `/` e `/inicio` | React nativo + CMS + trabalhos recentes |
| Galeria | `/galeria` | React nativo + filtros + lightbox |
| Sobre | `/sobre` | React nativo + conteúdo Supabase + fallback equivalente |
| Contato | `/contato` | React nativo + Edge Function de contato |
| Área do Cliente | `/area-cliente` | React nativo (experiência premium), sem indexação |
| Admin V2 | `/admin`, `/admin/galerias`, `/admin/categorias`, `/admin/design`, `/admin/ensaios`, `/admin/mensagens`, `/admin/configuracoes` | React nativo, sem indexação |

A migração para componentes nativos foi concluída para todas as rotas acima; não existem mais pontes de iframe carregando HTML/CSS/JS legado. Cada rota do admin usa o layout compartilhado `AdminSectionShell` para manter a barra lateral, o cabeçalho e a navegação consistentes entre si.
