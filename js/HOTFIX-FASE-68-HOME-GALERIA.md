# Correção da Fase 68 — início e galeria

Arquivos alterados:

- `next-app/components/home-hero.tsx`
- `next-app/components/gallery-experience.tsx`
- `next-app/app/globals.css`

Correções incluídas:

- restaura a fotografia principal usando os caminhos atuais em `public/legacy/images`;
- corrige a quebra e o tamanho do título principal no celular;
- restaura a rolagem automática da trilha escolhida até as categorias;
- preserva a edição visual dos elementos do hero no painel administrativo.

Validações concluídas:

- TypeScript sem erros;
- build de produção concluído;
- imagens principal e móvel disponíveis nos novos caminhos.
