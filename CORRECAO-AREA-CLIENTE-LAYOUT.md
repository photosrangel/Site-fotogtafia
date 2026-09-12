# Correção — Área do Cliente mantém o primeiro layout

Data: 12/09/2026

## Problema
A página `/area-cliente` carregava primeiro o layout editorial definido em `area-cliente.html`, mas alguns instantes depois o `js/main.js` buscava `design/published` no Supabase e substituía a capa pelos valores antigos publicados no Admin (imagem de fundo, título e textos).

## Correção aplicada
- A capa inicial da Área do Cliente passou a ser fixa e usa sempre o layout/textos presentes no HTML.
- A imagem de fundo publicada pelo Admin não substitui mais a capa inicial.
- Overrides de texto/estilo publicados não alteram os campos da capa inicial.
- As configurações da galeria depois do login (etapas/status/grade) continuam funcionando normalmente.
- A proteção foi aplicada tanto no legado quanto na ponte Next.js, evitando que o `PublishedVisualDesign` reescreva a capa dentro do iframe.

## Arquivos alterados
- `next-app/public/legacy/js/main.js`
- `next-app/components/published-visual-design.tsx`
- `js/main.js` (cópia legada da raiz, mantida consistente)

## Resultado esperado
Ao abrir `/area-cliente`, deve permanecer o layout com:
- lado esquerdo escuro sem fotografia de fundo;
- título “Um espaço só seu.”;
- painel direito “Entre no seu espaço privado.”;
- texto “Bem-vinda à sua galeria”.

O layout não deve mais mudar alguns segundos depois do carregamento.
