# Configuração dos e-mails automáticos — CMS V2

Esta versão já contém o fluxo completo no site e no Admin V2. Para os e-mails começarem a sair, faça estes passos uma única vez.

## 1. Atualizar o banco

No Supabase → **SQL Editor**, abra e execute:

`supabase/2026-08-18_email_workflow.sql`

Se ainda não executou a migração de capa dos ensaios, execute também:

`supabase/2026-08-18_add_ensaio_cover_photo.sql`

## 2. Criar/configurar o Resend

1. Crie uma conta no Resend.
2. Adicione e verifique o domínio que será usado para enviar os e-mails.
3. Crie uma API Key com permissão de envio.

Sugestão de remetente depois que o domínio estiver verificado:

`Rangel Santos Fotografia <fotos@SEU-DOMINIO.pt>`

## 3. Criar os Secrets da Edge Function

No Supabase → Edge Functions → Secrets, crie:

- `RESEND_API_KEY` = sua chave `re_...`
- `EMAIL_FROM` = `Rangel Santos Fotografia <fotos@SEU-DOMINIO.pt>`
- `SITE_URL` = URL pública do seu site, sem barra no final
- `PHOTOGRAPHER_EMAIL` = e-mail que deve receber o aviso de seleção
- `ADMIN_USER_ID` = ID do seu usuário administrador do Supabase Auth (recomendado)

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já são disponibilizados pelo Supabase para as Edge Functions hospedadas.

## 4. Publicar a Edge Function

A função está em:

`supabase/functions/ensaio-notifications/index.ts`

Com Supabase CLI:

```bash
supabase functions deploy ensaio-notifications --no-verify-jwt
```

O `--no-verify-jwt` é intencional porque a cliente não possui conta no Supabase Auth. A própria função valida o `ensaio_id + codigo_acesso` para o evento de seleção. A publicação das fotos finais continua exigindo um usuário autenticado do Admin V2.

## 5. Publicar o site

Depois do SQL e da Edge Function, publique os arquivos do ZIP normalmente.

## Fluxo implementado

1. Fotógrafo cria o ensaio com nome + e-mail da cliente.
2. Fotógrafo adiciona provas e envia para seleção.
3. Cliente seleciona as fotos e clica **Finalizar seleção**.
4. A cliente confirma a quantidade em uma janela de revisão.
5. Supabase registra `selecao_finalizada` e a data.
6. Cliente recebe confirmação por e-mail.
7. Fotógrafo recebe aviso da seleção com quantidade escolhida.
8. No Admin V2 aparece **Seleção → Edição → Entrega**.
9. Fotógrafo clica **Iniciar edição**.
10. Upload das finais não envia nenhum e-mail.
11. Fotógrafo clica **Publicar fotos finais**.
12. As finais ficam disponíveis e a cliente recebe o e-mail de entrega.

Os campos `email_*_enviado_em` evitam que os mesmos e-mails sejam disparados novamente por atualização da página ou cliques repetidos.
