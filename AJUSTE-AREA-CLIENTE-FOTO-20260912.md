# Ajuste — fotografia da Área do Cliente

Data: 12/09/2026

## O que foi ajustado

- O layout editorial fixo da tela inicial da Área do Cliente continua preservado.
- O painel Admin volta a controlar somente a fotografia de fundo dessa tela e seu enquadramento.
- É possível adicionar uma fotografia JPG, PNG ou WebP pelo painel.
- É possível remover a fotografia; quando não existe fotografia publicada, o fundo escuro/cinza original do layout permanece.
- O ponto focal pode ser escolhido clicando diretamente na prévia da fotografia.
- Foram adicionados controles manuais Horizontal e Vertical (0–100%) para ajuste preciso do ponto central.
- O botão principal foi renomeado para “Salvar e aplicar no site”.
- Ao salvar, `client_access_image`, `client_focus_x` e `client_focus_y` são gravados no design publicado e lidos pela Área do Cliente pública.

## Comportamento importante

A remoção tira a fotografia da Área do Cliente publicada. O arquivo antigo não é apagado automaticamente do Storage, evitando exclusão acidental de um arquivo que possa estar em uso.

## Fonte dos dados

A implementação reaproveita a persistência de Design já existente no projeto. Nenhuma migração de banco de dados é necessária, pois os campos da fotografia e do ponto focal já faziam parte da configuração publicada.
