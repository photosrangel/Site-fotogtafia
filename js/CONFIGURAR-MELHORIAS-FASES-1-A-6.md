# Ativação segura — fases 1 a 6

O código está preparado, mas as funções de servidor e as chaves precisam ser ativadas nesta ordem. Faça primeiro num projeto de teste ou numa branch de preview.

## 1. Banco e funções

1. Supabase → SQL Editor → New query.
2. Cole e execute `supabase/migrations/20260904_security_observability.sql`.
3. Edge Functions: publique `admin-login-guard`, `client-access`, `contact-notifications` e mantenha `session-lifecycle`.
4. Edge Functions → Secrets: crie `ADMIN_LOGIN_RATE_LIMIT_PEPPER`, `CLIENT_ACCESS_RATE_LIMIT_PEPPER` e `CONTACT_RATE_LIMIT_PEPPER`, cada um com pelo menos 32 caracteres aleatórios e valores diferentes.
5. Acrescente `RESEND_API_KEY`, `EMAIL_FROM` e `TURNSTILE_SECRET_KEY`.

## 2. Turnstile

1. Cloudflare → Turnstile → Add site → domínio `photosrangel.pt`.
2. Copie a Secret Key para `TURNSTILE_SECRET_KEY` no Supabase.
3. Copie a Site Key para `TURNSTILE_SITE_KEY` em `js/supabase-config.js` e na cópia `next-app/public/legacy/js/supabase-config.js`.
4. Teste um acesso correto, um incorreto, o desafio expirado e “Esqueci meu código”.

## 3. Google e proteção nativa do Auth

1. Google Cloud Console → OAuth consent screen e Credentials → OAuth client Web.
2. Use a callback mostrada em Supabase → Authentication → Providers → Google.
3. Ative Google no Supabase e informe Client ID/Secret.
4. Authentication → URL Configuration: Site URL `https://photosrangel.pt`; Redirect URLs `https://photosrangel.pt/admin` e o domínio de preview.
5. Não crie outro administrador: vincule a identidade Google ao mesmo utilizador autorizado, pois o painel valida o UUID do Admin.
6. Authentication → Rate Limits: confirme que limites de sign-in e verificação estão ativos. O `admin-login-guard` acrescenta 8 tentativas/15 min por IP com hash; não substitui a proteção nativa.
7. No primeiro login por senha, leia o QR Code TOTP e confirme o código. Guarde os meios de recuperação fora do computador.

## 4. E-mail de recuperação

No Resend, valide o domínio remetente definido em `EMAIL_FROM`. “Esqueci meu código” nunca aceita um endereço digitado: consulta somente o e-mail que já está no ensaio. Limite: 3 pedidos/hora por IP.

## 5. Marca de água

Novas fotos enviadas como `prova` recebem a marca uma vez no navegador, antes do upload. Fotos finais não são alteradas. Faça um teste com uma cópia antes do uso em produção; fotos antigas não são processadas novamente.

## 6. Privacidade, cookies e analytics

Revise `privacidade.html` e `termos.html` com um profissional antes da publicação. O banner bloqueia analytics por padrão. PostHog/Google Analytics só devem ser carregados depois do evento `rangel:consent` indicar `detail.analytics === true`. Não há analytics ativo neste pacote.

## 7. SEO

Depois do deploy, abra `/robots.txt` e `/sitemap.xml`, valide os dados estruturados e cadastre o domínio no Google Search Console. Envie `https://photosrangel.pt/sitemap.xml`. Os novos campos de SEO de galerias foram preparados no banco; a publicação dinâmica por galeria deve ser ativada somente depois de preencher os campos no painel.

## 8. Backups e recuperação

1. Supabase → Settings → Billing/Plan e Database → Backups: confirme a frequência e retenção do plano atual.
2. Crie um projeto separado de teste. Restaure ali um backup recente; nunca teste restauração sobre produção.
3. Verifique contagens de `galleries`, `gallery_photos`, `ensaios`, `fotos`, `site_content` e `site_settings`, abra uma galeria pública e uma área de cliente.
4. Guarde mensalmente: export SQL, cópia dos buckets, ZIP do GitHub e lista das Edge Functions/secrets (sem guardar o valor das chaves no Git).

## 9. Monitoramento e limpeza

- `security_events` registra login administrativo, acessos de cliente, reenvios e contato sem guardar IP puro.
- Retenção recomendada: 90 dias. Agende `select public.cleanup_security_events();` diariamente pelo Supabase Cron.
- Agende `session-lifecycle` diariamente com `CRON_SECRET` e alerte para resposta não-2xx.
- Configure alertas de erros 5xx na Vercel e de uso/saúde no Supabase.

## Critérios finais

- Admin: senha, Google, TOTP, utilizador não autorizado e bloqueio por excesso.
- Cliente: código correto/incorreto, Turnstile, reenvio, URL assinada e expiração.
- Upload: prova marcada e foto final sem marca.
- Contato: envio, honeypot e sexto envio/hora bloqueado.
- RGPD: páginas e banner visíveis; nenhum analytics antes do aceite.
- SEO: canonical, Open Graph, robots, sitemap e páginas privadas `noindex`.
- Recuperação: restauração concluída e documentada num ambiente separado.
