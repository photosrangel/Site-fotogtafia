# session-lifecycle

Função diária para avisar a cliente sete dias antes da expiração e remover somente as fotografias expiradas. O registro do ensaio e todo o histórico da cliente permanecem no banco. Publique com `supabase functions deploy session-lifecycle --no-verify-jwt` e agende uma chamada diária protegida por `CRON_SECRET`.
