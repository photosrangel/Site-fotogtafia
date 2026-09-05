# Recuperação dos dados da galeria pelo e-mail

Esta atualização permite que a cliente recupere o login e crie uma nova senha usando somente o e-mail cadastrado no ensaio.

## Ordem obrigatória

1. No Supabase, abra **SQL Editor** e execute todo o conteúdo de `supabase/migrations/20260905_client_email_recovery.sql`.
2. No Supabase, substitua o código da Edge Function **client-access** pelo arquivo `supabase/functions/client-access/index.ts` e clique em **Deploy updates**.
3. No GitHub, substitua `next-app/public/legacy/area-cliente.html` pelo arquivo de mesmo caminho deste pacote e confirme a alteração.
4. Aguarde o novo deployment da Vercel terminar.

## Segredo opcional recomendado

Na área de Secrets das Edge Functions, adicione `SITE_URL` com o valor `https://www.photosrangel.pt`.
Sem esse segredo, o endereço oficial acima já é usado automaticamente.

## Teste seguro

1. Use um ensaio de teste cadastrado com o seu próprio e-mail.
2. Abra `/area-cliente` e clique em **Esqueci meus dados de acesso**.
3. Informe o e-mail e conclua a verificação humana.
4. Confira o e-mail premium: ele deve mostrar o login e o botão **Criar nova senha**.
5. Crie uma senha de no mínimo 6 caracteres.
6. Entre com o login informado e a nova senha.
7. Confirme no painel administrativo que a senha do mesmo ensaio foi atualizada.

O site exibe a mesma resposta mesmo quando o e-mail não existe, para impedir que terceiros descubram quais clientes possuem galerias.
