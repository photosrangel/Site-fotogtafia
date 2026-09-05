# Fase 68 — aplicação segura

## 1. Aplicar

No Supabase, abra **SQL Editor > New query**, cole todo o conteúdo de:

`migrations/20260823_fase_68_rls_hardening.sql`

Clique em **Run**. O resultado esperado é `Success. No rows returned`.

## 2. Verificar

Somente depois do sucesso, abra outra consulta e execute:

`FASE-68-VERIFICACAO.sql`

Guarde o resultado para conferência.

## 3. Testes obrigatórios

- abrir o site público e navegar por Início, Galeria, Sobre e Contato;
- enviar uma mensagem de contato de teste;
- entrar no painel administrativo;
- confirmar galerias, categorias, ensaios, mensagens e Designer;
- fazer uma alteração reversível no painel e confirmar que ela salva;
- entrar na Área do Cliente com um ensaio de teste.

## Emergência

Se o primeiro SQL concluir, mas o painel deixar de funcionar, execute
`FASE-68-REVERSAO-EMERGENCIA.sql` e informe o erro exibido no console.
