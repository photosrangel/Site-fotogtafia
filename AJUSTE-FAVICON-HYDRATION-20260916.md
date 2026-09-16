# Ajuste favicon + hidratação — 16/09/2026

- Favicon removido de dentro do painel Área do Cliente.
- Criado painel exclusivo `Favicon`, logo abaixo de `Página Sobre` no Design.
- O painel mantém Adicionar ícone, Remover e Salvar e publicar de forma independente.
- O painel Favicon não recebe os botões genéricos de salvar/descartar do Design, pois já publica diretamente.
- Adicionada proteção de hidratação em `<html>` e `<body>` para atributos alterados pelo navegador/extensões/tradução antes do React hidratar, cenário compatível com React #418.
