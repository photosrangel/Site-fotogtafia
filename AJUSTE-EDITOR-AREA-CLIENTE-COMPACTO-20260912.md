# Ajuste do editor da Área do Cliente — 12/09/2026

## O que foi alterado

- A edição da Área do Cliente agora abre em um editor dedicado dentro da página Design.
- O iframe grande da página pública é ocultado enquanto a Área do Cliente está sendo editada.
- A prévia da fotografia foi limitada a um retângulo compacto 16:9, com largura máxima de 640 px.
- A fotografia continua usando `cover`, sem deformação, e respeita o ponto focal X/Y.
- O ponto focal voltou a ser exibido sobre a fotografia.
- Os sliders Horizontal e Vertical voltaram a aparecer.
- A prévia inclui os textos visuais da Área do Cliente para ajudar no enquadramento.
- Foram mantidos os botões Adicionar foto, Editar foto e Remover foto.
- Foi incluído o botão Salvar e aplicar no site dentro do próprio editor.
- Sem fotografia, o site público continua usando o fundo padrão escuro/cinza.

## Arquivos principais alterados

- admin-v2.html
- css/admin-v2.css
- js/admin-v2.js
- next-app/public/legacy/admin-v2.html
- next-app/public/legacy/css/admin-v2.css
- next-app/public/legacy/js/admin-v2.js
- cópias legadas equivalentes em /js

## Validação

A sintaxe dos dois arquivos JavaScript principais foi validada com `node --check`.
