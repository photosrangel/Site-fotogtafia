# Correção do flash da capa — Área do Cliente

Ao atualizar a página com F5, a capa publicada agora é lida de um cache local síncrono antes do primeiro paint. O Admin atualiza esse cache ao publicar e `main.js` o reconcilia com o Supabase em seguida.

- Com foto publicada: a foto e o ponto focal aparecem já no primeiro paint em recarregamentos subsequentes no mesmo navegador.
- Sem foto publicada: permanece o fundo cinza/escuro padrão.
- Em um navegador que nunca abriu o site, a área visual fica discretamente oculta durante a primeira consulta remota, evitando o flash cinza; depois o cache fica pronto para os próximos F5.
- O Supabase continua sendo a fonte de verdade.
