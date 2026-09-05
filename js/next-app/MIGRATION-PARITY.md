# Matriz de paridade Next.js

| Superfície atual | Rota Next.js | Estado na Fase 9 |
|---|---|---|
| Início (`index.html`) | `/` e `/inicio` | React nativo + CMS + trabalhos recentes |
| Galeria | `/galeria` | React nativo + filtros + lightbox |
| Sobre | `/sobre` | React nativo + conteúdo Supabase + fallback equivalente |
| Contato | `/contato` | React nativo + Edge Function de contato |
| Área do Cliente | `/area-cliente` | Ponte legada integral, sem indexação |
| Admin V2 | `/admin` | Ponte legada integral, sem indexação |

“Ponte legada integral” significa que o App Router já controla a rota e os metadados, enquanto o documento existente é carregado sem modificar seu HTML, CSS ou JavaScript. A navegação interna é promovida para a rota Next correspondente.

Nas próximas fases, cada ponte será substituída por componentes nativos somente depois de atingir paridade visual e funcional.
