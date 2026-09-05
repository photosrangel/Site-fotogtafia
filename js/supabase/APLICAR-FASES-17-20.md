# Ação necessária no Supabase

1. Abra o projeto no Supabase.
2. Entre em **SQL Editor**.
3. Crie uma nova consulta.
4. Copie todo o conteúdo de `migrations/20260821_fases_17_20.sql`.
5. Pressione **Run** uma única vez.
6. Confirme que aparece `Success. No rows returned`.

O script é idempotente e pode ser executado novamente caso a conexão seja interrompida. Ele cria a base de trilhas, atividades recentes e ciclo de expiração, sem apagar galerias, categorias, ensaios ou fotografias existentes.
