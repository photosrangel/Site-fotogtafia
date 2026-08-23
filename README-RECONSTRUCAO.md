# Reconstrução técnica — Fase 15

## Estado

Este checkpoint amplia o Designer do painel sem redesenhar o site. O visual público continua sendo o existente; a mudança é a capacidade de editar e publicar elementos diretamente pela prévia.

## Evolução da Fase 14

- o Designer passou a ter navegação direta entre Início, Galeria, Sobre, Contato e Área do Cliente;
- os antigos atalhos de formulários de conteúdo foram retirados da navegação do Designer;
- títulos, parágrafos, filtros, cartões, campos, informações e botões das cinco páginas podem ser selecionados na própria prévia;
- os textos da faixa informativa da página inicial — rótulos e valores de Baseado em, Especialidade e Disponibilidade — são editáveis separadamente;
- o texto e os links do rodapé também são editáveis;
- o menu principal do Admin ganhou o botão **Reordenar menu**; a nova ordem é persistida na configuração da interface do painel.

## Evolução da Fase 15

- Foto Estática e Slideshow voltaram ao Designer dentro do painel **Imagem principal**;
- foram preservados upload principal e móvel, texto alternativo, ponto focal, fallback, intervalo, transição, enquadramento, ordenação e gerenciamento das imagens do slideshow;
- a Prévia responsiva permanece no topo e agora pode ser recolhida ou expandida;
- os controles Cabeçalho, Imagem principal, Animações, Estilo geral, WhatsApp, Galerias e Área do Cliente passaram a aparecer um abaixo do outro;
- todos esses painéis podem ser expandidos e recolhidos individualmente;
- os controles deixaram de abrir como caixas laterais a partir do menu do Designer;
- o botão Design no menu administrativo abre diretamente a tela completa do Editor Visual.

## Editor visual

- edição direta de textos, botões e informações identificadas na prévia;
- suporte às páginas Início, Galeria, Sobre, Contato e Área do Cliente;
- controles de tamanho, negrito, itálico, alinhamento e posição horizontal/vertical;
- identificação automática de itens dinâmicos, como filtros, cartões, navegação, rodapé, formulário e informações de contato;
- botão **Aplicar** no editor local para confirmar a alteração na prévia;
- ações globais simplificadas para **Salvar alterações** e **Descartar alterações**;
- publicação dos estilos e textos no site, inclusive na Área do Cliente preservada pela ponte legada.

## Correções preservadas

- prévia responsiva sem depender da ativação de animações;
- transições sem repetir a página anterior;
- prevenção das incompatibilidades de hidratação que geravam o aviso vermelho;
- fontes, textos, imagens e dados continuam vindo do conteúdo existente/Supabase;
- nenhuma alteração deliberada de layout, paleta ou identidade visual.

## Validação executada

- `npm install`: concluído, 0 vulnerabilidades;
- `npm run typecheck`: aprovado;
- `npm run build`: aprovado com Next.js 16.3.2;
- verificação de sintaxe dos JavaScript legados: aprovada;
- verificação estrutural: sete rotas esperadas e quatro páginas públicas nativas;
- verificação de release, contrato de ambiente, metadados protegidos e cabeçalhos de segurança: aprovada;
- navegação pública conferida nas cinco áreas, com elementos editáveis presentes nas páginas nativas e na Área do Cliente.

## Uso

1. Abra o Admin e entre em **Designer**.
2. Escolha a página usando os botões Início, Galeria, Sobre, Contato e Área do Cliente acima da prévia.
3. Clique no texto, botão ou informação que deseja alterar.
4. Edite o conteúdo e a formatação e pressione **Aplicar**.
5. Use **Salvar alterações** para publicar tudo ou **Descartar alterações** para voltar à versão publicada.

Para mudar a ordem do menu administrativo, pressione **Reordenar menu**, arraste os itens e pressione **Concluir reordenação**.

## Arquivos operacionais

- `next-app/DEPLOYMENT.md`
- `next-app/ROLLBACK.md`
- `next-app/MIGRATION-PARITY.md`
- `next-app/scripts/verify-structure.mjs`
- `next-app/scripts/verify-release.mjs`

## Regra de produção

Validar primeiro numa URL de prévia independente. O domínio e o projeto atual só devem ser alterados depois da confirmação explícita do proprietário.

## Ajustes da Fase 21

- Trilhas agora são gravadas diretamente nas galerias e continuam vinculadas às categorias;
- categorias antigas conhecidas são organizadas automaticamente nas trilhas iniciais pela migração;
- ao escolher uma trilha no formulário de Galeria, aparecem somente as categorias correspondentes;
- a Galeria pública e a prévia exibem categorias e ensaios da trilha selecionada;
- botões rápidos do Dashboard foram posicionados abaixo da linha do cabeçalho;
- o cartão da Prévia responsiva ganhou a mesma hierarquia tipográfica dos demais painéis;
- **Reordenar painéis** passou para a barra superior, ao lado das ações globais;
- Foto estática e Slideshow agora funcionam como abas mutuamente exclusivas;
- URLs técnicas da foto estática foram substituídas por áreas de upload;
- o slideshow passa a ser criado dinamicamente também na prévia React;
- a expiração remove somente as fotografias e preserva o registro completo do ensaio/cliente;
- o aviso automático de expiração é enviado uma única vez, sete dias antes do prazo.

## Ajustes da Fase 22

- filtros públicos passam a ser calculados pelas galerias realmente associadas a cada trilha;
- galerias sem trilha aparecem somente em **Todas as galerias**;
- Autoestima & Sensual não recebe mais categorias ou galerias externas à trilha;
- voltar para **Todas as galerias** restaura automaticamente o filtro **Todas**;
- salvar uma galeria não altera mais a trilha global de sua categoria;
- capas de Trilhas e Galerias ganharam ponto focal horizontal e vertical, inclusive por clique direto na prévia;
- o botão redundante **Aplicar na prévia** foi removido do painel Imagem principal.

## Ajustes da Fase 23

- o cabeçalho público ganhou o formato editorial em cápsula da referência, mantendo as cores configuradas no site;
- marca, navegação e tipografia do cabeçalho foram refinadas sem alterar os destinos do menu;
- botões de Início, Galeria, Sobre, Contato e Área do Cliente passaram a usar o mesmo padrão arredondado;
- ações principais continuam preenchidas e ações secundárias permanecem contornadas, sempre usando a paleta existente;
- o rodapé foi reorganizado com chamada editorial, links do site, contatos, copyright, localização e assinatura tipográfica em grande escala;
- o layout se adapta para computador e celular sem remover conteúdo ou alterar os dados existentes.

## Ajustes da Fase 24

- cabeçalho público centralizado, totalmente transparente e delimitado por uma borda fina;
- Área do Cliente passou a seguir exatamente o mesmo padrão visual dos demais links do menu;
- botões ganharam altura, centralização e proporções uniformes em formato de cápsula;
- botões escuros usam um contorno claro discreto para permanecerem visíveis sobre fundos escuros;
- rodapé recomposto nas proporções da referência, com chamada editorial à esquerda, navegação e contatos à direita;
- copyright e localização foram agrupados no canto inferior direito;
- “Rangel Santos” aparece centralizado como marca d’água serifada em grande escala;
- todas as alterações continuam utilizando as cores configuradas no site.

## Ajustes da Fase 25

- cabeçalho reduzido verticalmente e ocultado assim que a rolagem para baixo começa;
- chamada e links do rodapé foram reduzidos e reposicionados conforme a referência;
- copyright e localização permanecem na mesma linha, agora no canto inferior esquerdo;
- marca d’água ganhou peso mais fino, maior espaçamento e posição vertical mais alta;
- categorias editoriais conhecidas são restauradas nas trilhas corretas por uma migração segura;
- o visualizador de ensaios passa a mostrar a fotografia atual acompanhada das fotos anterior e seguinte;
- fotografias do visualizador respeitam limites de largura e altura em desktop, ultrawide e celular.

## Ajustes da Fase 26

- o filtro Corporativo permanece disponível mesmo quando o cadastro antigo não é devolvido pela consulta pública;
- galerias corporativas sem relacionamento legível recebem identificação segura pelo título ou slug;
- Autoestima & Sensual exibe somente Autoestima, Sensual e Boudoir quando existente;
- rodapé voltou a seguir integralmente a composição da referência: links à direita, divisor horizontal, copyright à esquerda e localização à direita;
- chamada editorial e marca d’água foram reposicionadas nas proporções da imagem de referência.

## Ajustes da Fase 27

- botões públicos contornados foram padronizados em 205 × 66 px;
- botões públicos preenchidos foram padronizados em 240 × 66 px;
- textos permanecem centralizados horizontal e verticalmente;
- em celulares estreitos, os botões passam a ocupar a largura disponível sem ultrapassar a tela.

## Ajustes da Fase 28

- o padrão de cápsulas passou a abranger Início, Galeria, Sobre, Contato e Área do Cliente;
- filtros contornados da Galeria usam 205 × 66 px e o filtro ativo preenchido usa 240 × 66 px;
- o contorno do cabeçalho foi aproximado verticalmente do nome e dos links;
- todas as cápsulas continuam ocupando a largura disponível em celulares estreitos.

## Ajustes da Fase 29

- o contorno do cabeçalho passou a acompanhar a largura real da marca e dos links;
- a cápsula foi reduzida verticalmente para aproximar a borda do texto;
- o conjunto permanece centralizado em telas desktop e preserva a largura funcional no celular.

## Ajustes da Fase 30

- botões e filtros públicos deixaram de usar larguras fixas;
- cada cápsula acompanha o tamanho real do texto com espaçamento interno uniforme;
- a altura foi compactada para 58 px no desktop e 54 px no celular;
- o padrão foi aplicado em Início, Galeria, Sobre, Contato e Área do Cliente.

## Ajustes da Fase 31

- cápsulas públicas reduzidas para 52 px de altura no desktop e 50 px no celular;
- espaçamento horizontal interno reduzido sem encostar o contorno no texto.

## Ajustes da Fase 32

- cápsulas públicas ajustadas para 48 px de altura e 22 px de espaçamento lateral;
- o tamanho da fonte permaneceu inalterado;
- o botão principal da Área do Cliente acompanha toda a largura do campo de senha;
- o texto desse botão permanece centralizado horizontal e verticalmente.

## Ajustes da Fase 33

- cabeçalho ampliado horizontalmente sem aumentar sua altura compacta;
- logotipo fixado visualmente no lado esquerdo e navegação no lado direito;
- distância entre os links do menu reduzida para formar um conjunto mais uniforme.

## Ajustes da Fase 34

- cabeçalho ampliado novamente, agora com largura máxima de 1360 px;
- margens laterais reduzidas para aproximar a cápsula das extremidades em telas menores;
- altura compacta, logotipo à esquerda e navegação agrupada à direita foram preservados.

## Ajustes da Fase 35

- largura máxima do cabeçalho ampliada para 1480 px;
- margens laterais reduzidas para aproveitar melhor telas largas;
- altura da cápsula aumentada levemente para 48 px no computador e 46 px no celular.

## Ajustes da Fase 36

- largura máxima do cabeçalho definida em 1800 px;
- altura da cápsula definida em 52 px no computador;
- logotipo à esquerda e navegação agrupada à direita preservados;
- no celular, altura de 46 px e margens compactas preservam espaço e legibilidade.

## Ajustes da Fase 37

- cabeçalho passou a ocupar somente o espaço realmente disponível em cada tela, sem cortes em 1920×1080;
- largura máxima de 1800 px continua preservada em monitores ultrawide;
- margens do cabeçalho agora se adaptam a desktop, ultrawide e celular;
- prévia móvel do Designer não ativa a edição direta, permitindo navegar normalmente pelo menu;
- menu móvel recebeu botão visível para fechar e também pode ser fechado pela tecla Esc.

## Ajustes da Fase 38

- textos do rodapé reduzidos sem alterar suas posições nem a marca-d'água;
- colunas Site e Conecte-se aproximadas e mantidas no lado direito;
- Trabalhos recentes ganhou grade própria para evitar imagens exageradas ou pequenas demais;
- grade usa quatro colunas no desktop, cinco no ultrawide, três em telas intermediárias e duas no celular;
- celulares muito estreitos exibem uma imagem por linha para preservar a fotografia.

## Ajustes da Fase 39

- a opção Todas as galerias passou a usar a mesma escala responsiva de Trabalhos recentes;
- são cinco colunas no ultrawide, quatro no desktop, três em telas intermediárias e duas no celular;
- celulares extremamente estreitos exibem uma coluna;
- ao selecionar uma trilha ou categoria, o comportamento adaptativo específico continua preservado.

## Ajustes da Fase 40

- trilhas e categorias agora usam exatamente a mesma grade responsiva de Todas as galerias;
- capas com poucos resultados mantêm tamanho uniforme e ficam alinhadas à esquerda;
- nenhuma capa se estica para ocupar artificialmente toda a largura disponível.

## Ajustes da Fase 41

- chamada principal, títulos, links e linha inferior do rodapé foram reduzidos novamente;
- posições dos blocos e marca-d'água permaneceram inalteradas;
- colunas Site e Conecte-se agora ficam separadas por apenas 12 px no desktop;
- tipografia também foi equilibrada para telas menores.

## Ajustes da Fase 42

- corrigida a categoria Externo aparecendo temporariamente dentro de Autoestima & Sensual;
- trilhas conhecidas agora validam suas categorias pelo significado, além do vínculo salvo no banco;
- Autoestima & Sensual aceita somente Autoestima, Sensual e Boudoir;
- Retratos & Corporativo aceita Estúdio, Externo, Corporativo e Retratos;
- rota da Galeria deixou de reutilizar dados antigos durante a navegação normal.

## Ajustes da Fase 43

- identificação das trilhas deixou de depender de um slug exato;
- nomes com “e”, “&”, espaços, hífens, maiúsculas ou acentos são reconhecidos corretamente;
- regra foi aplicada tanto no carregamento do servidor quanto na interação da Galeria;
- site público e prévia do admin agora compartilham a mesma separação determinística das categorias.

## Ajustes da Fase 44

- corrigida a troca visual de Sensual por Externo após alternar entre trilhas na prévia;
- botões dinâmicos de categorias deixaram de reutilizar identificadores do editor visual;
- nomes de categorias continuam sendo administrados pela tela Categorias, que é a fonte correta desses dados;
- limpeza preventiva remove identificadores antigos que ainda estejam presentes numa prévia já carregada.

## Ajustes da Fase 45

- trilhas existentes ganharam ação Editar no painel Categorias;
- o slug é mostrado e regenerado automaticamente enquanto o nome é digitado;
- salvar uma edição cria um rascunho persistente e atualiza os seletores do painel;
- a prévia da Galeria recebe imediatamente o nome e a descrição do rascunho;
- Publicar alterações no site grava nome, slug e descrição definitivos na trilha pública;
- nenhuma alteração de banco de dados foi necessária para esse fluxo.

## Ajustes da Fase 46

- a prévia da Galeria agora replica exatamente a ordem exibida no painel Trilhas;
- editar o nome de uma trilha não altera mais sua posição visual;
- ao publicar, a sequência administrativa é normalizada em intervalos de dez;
- site público, prévia e painel passam a compartilhar a mesma ordem persistente.

## Evolução das Fases 16 a 20

- os controles do Designer atualizam a prévia imediatamente e cada painel ganhou ações próprias para salvar ou descartar;
- as ações globais foram movidas para o topo e agora publicam ou descartam o conjunto completo de alterações;
- os painéis do Designer podem ser reordenados e a ordem fica memorizada no navegador;
- o cabeçalho público recolhe ao descer a página e reaparece ao subir;
- o Dashboard ganhou atalhos principais e uma lista de atividades recentes reais;
- a página Configurações concentra os dados gerais do site e a personalização da interface administrativa;
- Galerias passaram a trabalhar com Trilhas e Categorias, inclusive com criação e associação pelo painel;
- a Galeria pública mostra cartões de trilhas, filtros correspondentes e grades adaptativas sem reservar espaços vazios;
- Trabalhos recentes na página inicial também usam preenchimento automático da grade;
- ao iniciar a edição de um ensaio, os números escolhidos são preservados e as provas são removidas do armazenamento;
- durante a edição, a Área do Cliente mostra somente o agradecimento/andamento, sem repetir as provas apagadas;
- a entrega inicia prazo de 30 dias, permite extensão manual e envia um aviso automático sete dias antes da expiração;
- a função `session-lifecycle` faz a limpeza automática ao expirar e registra essas ações no Dashboard.

## Banco e automação

- migração aplicada: `supabase/migrations/20260821_fases_17_20.sql`;
- função automática: `supabase/functions/session-lifecycle/index.ts`;
- instruções de ativação: `supabase/ATIVAR-AUTOMACAO-EXPIRACAO.md`.
## Fase 47 — ordem das trilhas estável na prévia React

- A prévia do Designer agora conserva a mesma ordem das trilhas exibida no painel, inclusive depois que o React atualiza a galeria.
- A sincronização também é reaplicada ao alternar entre trilhas e filtros, sem recarregar a página.
- A verificação evita movimentações desnecessárias no DOM e não cria ciclos de atualização.
## Fase 48 — grade e reordenação de trilhas

- As trilhas agora aparecem lado a lado em cartões, aproveitando melhor o espaço do painel.
- Cada cartão possui controles para mover a trilha para a esquerda ou para a direita.
- A nova sequência é salva no rascunho, atualizada imediatamente na prévia e persistida no site ao publicar.
- Em telas menores, a grade adapta-se automaticamente para duas ou uma coluna.
## Fase 49 — WhatsApp publicado no site Next.js

- O site público agora lê a configuração publicada do WhatsApp, não apenas a prévia do Designer.
- Estado ativo, número, mensagem, posição, estilo e páginas selecionadas são respeitados.
- O botão não aparece na Área do Cliente, mantendo a lista de páginas configurável do painel.
## Fase 50 — título principal com mais destaque no celular

- O título “Você, como sempre foi.” ficou maior na versão celular.
- O texto de apoio abaixo foi reduzido e aproximado do título.
- Computador, desktop e ultrawide permanecem inalterados.
## Fase 51 — edição de textos na prévia celular

- O editor visual direto foi liberado também no modo Celular da prévia responsiva.
- Títulos, textos de apoio, botões e demais elementos já editáveis no computador podem ser selecionados no celular.
- A logo e os itens do menu continuam bloqueados no modo celular, preservando a navegação e o botão de fechar.
- Tamanho, negrito, itálico, alinhamento e posição ajustados no modo Celular ficam restritos ao celular; o texto continua compartilhado entre os dispositivos.
## Fase 52 — hidratação segura e foco móvel independente

- O painel não altera mais atributos do `<html>` antes da hidratação do React, eliminando o aviso mostrado na prévia.
- A aplicação das ferramentas do Designer aguarda o evento de hidratação nas páginas Next.js.
- A foto estática ganhou ponto focal horizontal e vertical exclusivo para celular.
- O enquadramento móvel pode ser escolhido clicando diretamente na prévia celular ou usando os controles.
- O foco do computador permanece independente e os valores antigos continuam compatíveis.
## Fase 53 — escala correta e editor de texto organizado

- O tamanho do texto agora usa uma escala percentual de 50% a 250% calculada sobre o tamanho real de cada elemento.
- Foi corrigido o comportamento em que a opção “Maior” podia reduzir títulos grandes por usar a fonte do elemento pai como referência.
- Tamanho e posição, além de estilo e alinhamento, foram organizados em painéis que expandem e recolhem.
- O editor continua oculto e só aparece depois que um texto editável é selecionado na prévia.
- Os ajustes continuam independentes entre computador e celular e permanecem compatíveis com configurações antigas.
## Fase 54 — rodapé editorial completo no celular

- O rodapé móvel passou a conservar a mesma composição visual do computador.
- A chamada permanece à esquerda e as colunas “Site” e “Conecte-se” ficam lado a lado à direita.
- A marca-d’água “Rangel Santos” permanece centralizada ao fundo.
- A linha inferior com copyright e localização foi preservada e continua adaptada às telas estreitas.
## Fase 55 — compactação final do rodapé móvel

- Foi reduzido o espaço vazio entre a última linha da galeria e o rodapé.
- A chamada e as colunas foram deslocadas para baixo, imediatamente acima da marca-d’água.
- A marca-d’água agora se dimensiona pela largura do celular e fica apoiada na base.
- Copyright e localização permanecem legíveis sobre a marca-d’água, com a linha divisória mais próxima do conteúdo.
## Fase 56 — gravação confiável da edição móvel

- O botão “Aplicar” agora fixa uma cópia completa dos estilos antes de a página reconstruir a prévia.
- O bloco específico do celular é gravado integralmente no rascunho e reaplicado após a confirmação do banco.
- Textos visuais que não possuem um campo tradicional no formulário agora também são realmente salvos.
- Computador e celular continuam com estilos independentes, sem um dispositivo sobrescrever o outro.
## Fase 57 — proximidade entre galeria e rodapé móvel

- O espaço depois da última linha de Trabalhos recentes foi reduzido no celular.
- O rodapé começa mais próximo das fotografias, sem alterar a grade ou cortar imagens.
- A coluna “Site” foi aproximada da coluna “Conecte-se”, preservando a chamada à esquerda.
- O ajuste permanece restrito às telas móveis.
## Fase 58 — alinhamento vertical definitivo do rodapé móvel

- A margem antiga entre Trabalhos recentes e o rodapé foi removida no celular.
- A linha superior do rodapé agora começa logo depois da grade de fotografias.
- A chamada e as colunas foram posicionadas na parte inferior do rodapé, próximas à linha do copyright.
- A distância entre os textos superiores, a linha inferior, o copyright e o endereço foi reduzida.
## Fase 59 — linha do rodapé encaixada na página inicial

- A linha superior do rodapé móvel foi aproximada simultaneamente das fotografias e da chamada.
- O espaço residual da seção de Trabalhos recentes foi compensado sem alterar o tamanho das imagens.
- A chamada e as colunas começam logo abaixo da linha, preservando uma margem curta e uniforme.
- O ajuste é específico da página inicial no celular e não interfere nos rodapés de outras páginas.
## Fase 60 — Dashboard estável e início móvel mais compacto

- Foi criada a função de formatação de data que faltava no carregamento de “Atividade recente”.
- Datas vazias ou inválidas não interrompem mais a inicialização do painel.
- A falha que podia impedir o editor visual de concluir o salvamento foi removida.
- O espaço entre o final do herói e “Trabalhos recentes” foi reduzido somente no celular.
## Fase 61 — rascunho não é mais sobrescrito na prévia

- A prévia do Designer agora é identificada explicitamente depois da hidratação do React.
- O aplicador do site publicado deixa de competir com o rascunho enquanto a página está dentro do painel.
- Ao clicar em “Aplicar”, texto e formatação permanecem visíveis imediatamente na prévia móvel.
- Fora do painel, o site público continua usando exclusivamente a configuração publicada.
## Fase 62 — informações completas em Sobre e Contato

- A prévia de “Sobre” não substitui mais as quatro informações por uma lista incompleta do rascunho.
- “Baseado em”, “Especialidade”, “Prazo de entrega” e “Atende” são combinados com os valores salvos.
- A prévia de “Contato” preserva o texto padrão de Atendimento quando o campo do rascunho estiver vazio.
- O comportamento da prévia agora acompanha a mesma lógica de fallback usada pelo site público.
## Fase 63 — proteção responsiva do título móvel

- O título principal do celular ganhou limite seguro de 160% para impedir cortes em telas estreitas.
- Um valor extremo já existente no rascunho é corrigido visualmente ao recarregar a prévia.
- O controle mostra o tamanho realmente aplicado e não volta a gravar 250% nesse título específico.
- Os demais textos continuam permitindo escala de 50% a 250%.
## Fase 64 — primeira prévia sincronizada após F5

- A prévia inicial agora aguarda a hidratação do site e o carregamento do rascunho.
- A página só é marcada como preparada depois que os dois processos terminam.
- Atualizar o admin com F5 passa a mostrar o mesmo título visto depois de navegar e voltar para Início.
- Foi eliminada a diferença visual causada pela corrida entre React e a consulta ao banco.
## Fase 65 — dispositivo móvel preservado e reaplicado

- O Designer memoriza se a prévia estava em Computador ou Celular antes do F5.
- O estado interno do motor passa a iniciar no mesmo dispositivo mostrado pela interface.
- Ao selecionar Celular, o bloco móvel do rascunho é reaplicado imediatamente e em duas confirmações curtas.
- O título correto deixa de depender de navegar para outra página e voltar para Início.
## Fase 66 — proteção contra força bruta na Área do Cliente

- o formulário de slug + código deixa de chamar a RPC privilegiada diretamente do navegador;
- a nova Edge Function `client-access` identifica e resume o IP em hash, sem armazenar o endereço original;
- o banco limita falhas por IP e por combinação IP/slug, com janela de 15 minutos e bloqueio de 30 minutos;
- a RPC interna aceita chamadas somente da `service_role`;
- a revogação da RPC legada foi separada em uma migration final para não interromper o acesso durante a publicação;
- o comportamento visual e os dados retornados para um acesso válido foram preservados.

## Fase 67 — fotografias privadas com URLs temporárias

- a Edge Function `client-access` passa a entregar fotografias das clientes por URLs assinadas válidas por uma hora;
- o painel administrativo também assina temporariamente as imagens do bucket `fotos` antes de exibi-las;
- o endereço original continua preservado internamente para exclusão, limpeza e expiração automática;
- as políticas de upload, leitura e exclusão do bucket privado ficam limitadas ao UID administrativo;
- `site-gallery` permanece público e não é alterado;
- a mudança definitiva do bucket `fotos` para privado foi isolada em uma migration final, executada somente após preview e testes.

### Checkpoint consolidado da Fase 67

- o site público, o painel administrativo, a aplicação Next.js e os arquivos legados usados pela prévia foram novamente sincronizados;
- os rodapés públicos, as trilhas da galeria e suas capas foram incorporados à base completa;
- a fotografia principal da prévia usa o caminho público estável `/images/...`, com cópias equivalentes no legado;
- o carregamento inicial do Design deixa de falhar quando o documento interno da prévia ainda está sendo montado;
- o Preview e a produção foram aprovados após a publicação das correções;
- este checkpoint substitui o ZIP da Fase 65 como base oficial para as próximas etapas.

### Ajuste responsivo do visualizador público

- a fotografia aberta pelo ensaio completo passa a ocupar quase toda a área útil da tela;
- `object-fit: contain` preserva integralmente a proporção, sem corte ou distorção;
- celular, desktop e ultrawide possuem limites próprios baseados na largura e na altura disponíveis;
- as fotografias anterior e seguinte permanecem visíveis nas laterais como apoio à navegação;
- a mesma folha visual é utilizada pelo site publicado e pela prévia do painel.
