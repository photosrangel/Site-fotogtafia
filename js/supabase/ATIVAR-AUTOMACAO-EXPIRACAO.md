# Ativar expiração e avisos automáticos

Esta é a única parte das Fases 16–20 que precisa ser ativada fora dos arquivos do projeto.

## 1. Publicar a função

No terminal do VS Code, dentro da pasta do projeto:

```powershell
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase functions deploy session-lifecycle --no-verify-jwt
```

O `project-ref` aparece no endereço do painel Supabase: `https://supabase.com/dashboard/project/SEU_PROJECT_REF`.

## 2. Configurar o envio de e-mail

No Supabase, abra **Edge Functions → Secrets** e cadastre:

- `RESEND_API_KEY`: chave da conta Resend;
- `EMAIL_FROM`: remetente validado, por exemplo `Rangel Santos <fotos@seudominio.com>`;
- `CRON_SECRET`: uma senha longa e aleatória para proteger a execução programada.

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos automaticamente à função pelo Supabase.

## 3. Programar uma execução diária

No painel Supabase, abra **Integrations → Cron**, crie um trabalho diário e configure uma chamada HTTP `POST` para:

```text
https://SEU_PROJECT_REF.supabase.co/functions/v1/session-lifecycle
```

Adicione o cabeçalho:

```text
x-cron-secret: O_MESMO_VALOR_DE_CRON_SECRET
```

Horário recomendado: uma vez por dia, às 09:00 no fuso de Portugal.

## Resultado

A rotina envia um aviso faltando sete dias, apaga somente as fotos expiradas, preserva o histórico do ensaio, marca o registro como expirado e registra a atividade no Dashboard. O botão **Estender prazo** no ensaio adia a data sem exigir nova entrega.
