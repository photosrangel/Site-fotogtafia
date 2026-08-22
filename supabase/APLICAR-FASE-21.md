# Aplicar a Fase 21

1. Abra o projeto **Meu portofio** no Supabase.
2. Entre em **SQL Editor** e crie uma nova consulta.
3. Copie todo o conteúdo de `migrations/20260821_fase_21_gallery_trails.sql`.
4. Cole no editor e pressione **Run**.
5. No terminal do VS Code, na pasta principal do projeto, publique novamente a rotina:

```powershell
npx supabase functions deploy session-lifecycle --project-ref xgjxbcxycwdetmsxycrq --no-verify-jwt
```

A migração adiciona `trail_id` às galerias, classifica categorias antigas conhecidas e preserva os dados existentes.
