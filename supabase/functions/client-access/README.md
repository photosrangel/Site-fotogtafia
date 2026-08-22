# client-access

Endpoint público controlado para o formulário de slug + código da Área do Cliente.
O endereço IP nunca é salvo diretamente: a função grava somente hashes com um
pepper secreto. Limites atuais: cinco falhas por combinação IP/slug ou 25 falhas
por IP em 15 minutos, seguidas de bloqueio por 30 minutos.

Configuração obrigatória:

1. criar o secret `CLIENT_ACCESS_RATE_LIMIT_PEPPER` com valor aleatório de no mínimo 32 caracteres;
2. aplicar `20260822_client_access_rate_limit_setup.sql`;
3. publicar com `supabase functions deploy client-access --no-verify-jwt`;
4. testar o acesso correto e o bloqueio;
5. aplicar `20260822_client_access_rate_limit_finalize.sql` para impedir chamadas anônimas à RPC antiga.

Na Fase 67, a mesma função troca os endereços permanentes do bucket `fotos` por
URLs assinadas válidas por uma hora. O bucket só deve ser tornado privado depois
de publicar o código e validar o painel com a migration
`20260822_private_client_photos_setup.sql`.
