# Plano de rollback

1. Manter o deploy legado atual ativo durante todo o preview.
2. Registrar a versão/commit atualmente em produção antes da promoção.
3. Se qualquer smoke test falhar, não promover o candidato.
4. Se houver falha após promoção, restaurar imediatamente o deployment anterior na plataforma de hospedagem.
5. Não reverter nem apagar dados do Supabase: a reconstrução reutiliza o mesmo esquema e o rollback é somente de aplicação.
6. Confirmar após rollback: site público, login do Admin, Área do Cliente, upload e mensagens.

O ZIP desta fase é um candidato técnico, não uma autorização de publicação.
