// ============================================================
// ADMIN V2 — RANGEL SANTOS FOTOGRAFIA
// CMS + ÁREA DE CLIENTES
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from './supabase-config.js';


// ============================================================
// SUPABASE
// ============================================================

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

console.log('ADMIN V2: Supabase inicializado');


// ============================================================
// ELEMENTOS
// ============================================================

const loginScreen =
  document.getElementById('login-screen');

const painel =
  document.getElementById('app');

const loginForm =
  document.getElementById('login-form');

const loginMsg =
  document.getElementById('login-msg');


// ============================================================
// ESTADO
// ============================================================

let detalheAberto = null;


// ============================================================
// UTILITÁRIOS
// ============================================================

function mostrarMensagem(
  elemento,
  texto,
  tipo = ''
) {

  if (!elemento) return;

  elemento.textContent = texto;

  elemento.className =
    tipo
      ? `msg ${tipo}`
      : 'msg';
}


function escaparHTML(valor) {

  const div =
    document.createElement('div');

  div.textContent =
    valor ?? '';

  return div.innerHTML;
}


function limparLogin(texto) {

  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}


function gerarLogin() {

  return (
    'cliente-' +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );
}


function gerarSenha() {

  return (
    Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()
  );
}


function nomeArquivoSeguro(nome) {

  return String(nome || 'foto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-');
}


// ============================================================
// LOGIN
// ============================================================

async function fazerLogin(event) {

  event.preventDefault();

  mostrarMensagem(
    loginMsg,
    'Entrando...'
  );

  const email =
    document.getElementById(
      'login-email'
    )?.value
      .trim();

  const senha =
    document.getElementById(
      'login-password'
    )?.value ||
    document.getElementById(
      'login-senha'
    )?.value;

  if (!email || !senha) {

    mostrarMensagem(
      loginMsg,
      'Preencha o e-mail e a senha.',
      'erro'
    );

    return;
  }

  const {
    error
  } = await supabase.auth.signInWithPassword({

    email,

    password: senha

  });

  if (error) {

    console.error(
      'ADMIN V2: erro no login:',
      error
    );

    mostrarMensagem(
      loginMsg,
      'E-mail ou senha incorretos.',
      'erro'
    );

    return;
  }

  mostrarMensagem(
    loginMsg,
    'Login realizado.',
    'sucesso'
  );

  await mostrarPainel();
}


async function verificarSessao() {

  console.log(
    'ADMIN V2: verificando sessão...'
  );

  const {
    data,
    error
  } = await supabase.auth.getSession();

  if (error) {

    console.error(
      'ADMIN V2: erro ao verificar sessão:',
      error
    );

    return;
  }

  if (data?.session) {

    console.log(
      'ADMIN V2: sessão encontrada.'
    );

    await mostrarPainel();

  } else {

    console.log(
      'ADMIN V2: nenhum usuário autenticado.'
    );
  }
}


async function fazerLogout() {

  const {
    error
  } = await supabase.auth.signOut();

  if (error) {

    console.error(
      'ADMIN V2: erro ao sair:',
      error
    );

    return;
  }

  window.location.reload();
}


async function mostrarPainel() {

  if (loginScreen) {

    loginScreen.hidden = true;
    loginScreen.style.display = 'none';
  }

  if (painel) {

    painel.hidden = false;
    painel.style.display = '';
  }

  await carregarEnsaios();
}


// ============================================================
// GERADORES
// ============================================================

function configurarGeradores() {

  const btnLogin =
    document.getElementById(
      'btn-gerar-login'
    );

  const btnCodigo =
    document.getElementById(
      'btn-gerar-codigo'
    );

  if (btnLogin) {

    btnLogin.addEventListener(
      'click',
      () => {

        const campo =
          document.getElementById(
            'novo-login'
          );

        if (campo) {
          campo.value =
            gerarLogin();
        }
      }
    );
  }

  if (btnCodigo) {

    btnCodigo.addEventListener(
      'click',
      () => {

        const campo =
          document.getElementById(
            'novo-codigo'
          );

        if (campo) {
          campo.value =
            gerarSenha();
        }
      }
    );
  }
}


// ============================================================
// CRIAR ENSAIO
// ============================================================

async function criarEnsaio(event) {

  event.preventDefault();

  const form =
    event.target;

  const mensagem =
    document.getElementById(
      'novo-ensaio-msg'
    );

  const titulo =
    document.getElementById(
      'novo-titulo'
    )?.value
      .trim();

  const clienteNome =
    document.getElementById(
      'novo-cliente'
    )?.value
      .trim();

  const categoria =
    document.getElementById(
      'novo-categoria'
    )?.value;

  const loginOriginal =
    document.getElementById(
      'novo-login'
    )?.value
      .trim();

  const codigo =
    document.getElementById(
      'novo-codigo'
    )?.value
      .trim();

  const slug =
    limparLogin(
      loginOriginal
    );

  if (!titulo) {

    mostrarMensagem(
      mensagem,
      'Digite o título do ensaio.',
      'erro'
    );

    return;
  }

  if (!slug) {

    mostrarMensagem(
      mensagem,
      'Digite um login válido para a cliente.',
      'erro'
    );

    return;
  }

  if (!codigo) {

    mostrarMensagem(
      mensagem,
      'Digite uma senha para a cliente.',
      'erro'
    );

    return;
  }

  mostrarMensagem(
    mensagem,
    'Criando ensaio...'
  );

  const {
    error
  } = await supabase
    .from('ensaios')
    .insert({

      titulo,

      cliente_nome:
        clienteNome || null,

      categoria:
        categoria || null,

      codigo_acesso:
        codigo,

      slug,

      status:
        'aguardando_selecao'

    });

  if (error) {

    console.error(
      'ADMIN V2: erro ao criar ensaio:',
      error
    );

    const textoErro =
      String(
        error.message || ''
      ).toLowerCase();

    if (
      textoErro.includes('duplicate') ||
      textoErro.includes('unique')
    ) {

      mostrarMensagem(
        mensagem,
        `O login "${slug}" já está em uso.`,
        'erro'
      );

    } else {

      mostrarMensagem(
        mensagem,
        'Erro ao criar ensaio: ' +
        error.message,
        'erro'
      );
    }

    return;
  }

  mostrarMensagem(
    mensagem,
    'Ensaio criado com sucesso!',
    'sucesso'
  );

  form.reset();

  await carregarEnsaios();
}


// ============================================================
// CARREGAR ENSAIOS
// ============================================================

async function carregarEnsaios() {

  const lista =
    document.getElementById(
      'lista-ensaios'
    );

  if (!lista) {

    console.log(
      'ADMIN V2: lista-ensaios não está presente.'
    );

    return;
  }

  lista.innerHTML = `
    <p class="msg">
      Carregando ensaios...
    </p>
  `;

  const {
    data: ensaios,
    error
  } = await supabase
    .from('ensaios')
    .select(`
      id,
      slug,
      titulo,
      cliente_nome,
      codigo_acesso,
      categoria,
      status,
      created_at
    `)
    .order(
      'created_at',
      {
        ascending: false
      }
    );

  if (error) {

    console.error(
      'ADMIN V2: erro ao carregar ensaios:',
      error
    );

    lista.innerHTML = `
      <p class="msg erro">
        Erro ao carregar ensaios:
        ${escaparHTML(error.message)}
      </p>
    `;

    return;
  }

  if (!ensaios || !ensaios.length) {

    lista.innerHTML = `
      <div class="ensaio-card">
        <p class="msg">
          Nenhum ensaio cadastrado ainda.
        </p>
      </div>
    `;

    return;
  }

  lista.innerHTML =
    ensaios
      .map(
        ensaioCardHTML
      )
      .join('');

  ensaios.forEach(
    ensaio => {

      const cabecalho =
        document.getElementById(
          `head-${ensaio.id}`
        );

      if (cabecalho) {

        cabecalho.addEventListener(
          'click',
          () =>
            toggleDetail(ensaio)
        );
      }
    }
  );

  console.log(
    'ADMIN V2: ensaios carregados:',
    ensaios
  );
}


// ============================================================
// CARD DO ENSAIO
// ============================================================

function ensaioCardHTML(ensaio) {

  return `

    <div class="ensaio-card">

      <div
        class="ensaio-card-head"
        id="head-${ensaio.id}"
      >

        <div>

          <strong
            style="
              font-family:var(--font-display);
              font-size:1.1rem;
            "
          >
            ${escaparHTML(
              ensaio.titulo
            )}
          </strong>

          <p
            class="footer-mono"
            style="margin-top:4px;"
          >
            ${escaparHTML(
              ensaio.cliente_nome || ''
            )}
          </p>

        </div>

        <span
          class="ensaio-status ${escaparHTML(
            ensaio.status || ''
          )}"
        >
          ${statusLabel(
            ensaio.status
          )}
        </span>

      </div>

      <div
        class="ensaio-detail"
        id="detail-${ensaio.id}"
      ></div>

    </div>

  `;
}


// ============================================================
// STATUS
// ============================================================

function statusLabel(status) {

  if (status === 'entregue') {

    return 'Entregue';
  }

  if (
    status === 'selecionado' ||
    status === 'aguardando_final'
  ) {

    return 'Cliente escolheu';
  }

  return 'Aguardando seleção';
}


// ============================================================
// DETALHE DO ENSAIO
// ============================================================

async function toggleDetail(ensaio) {

  const detail =
    document.getElementById(
      `detail-${ensaio.id}`
    );

  if (!detail) return;

  const estavaAberto =
    detail.classList.contains(
      'is-open'
    );

  if (
    detalheAberto &&
    detalheAberto !== detail
  ) {

    detalheAberto.classList.remove(
      'is-open'
    );
  }

  if (estavaAberto) {

    detail.classList.remove(
      'is-open'
    );

    detalheAberto = null;

    return;
  }

  detail.classList.add(
    'is-open'
  );

  detalheAberto = detail;

  await atualizarDetalheEnsaio(
    ensaio
  );
}


// ============================================================
// ATUALIZAR DETALHE
// ============================================================

async function atualizarDetalheEnsaio(
  ensaio
) {

  const detail =
    document.getElementById(
      `detail-${ensaio.id}`
    );

  if (!detail) return;

  detail.innerHTML = `
    <p class="msg">
      Carregando informações...
    </p>
  `;

  const {
    data: fotos,
    error
  } = await supabase
    .from('fotos')
    .select(`
      id,
      ensaio_id,
      url,
      tipo,
      selecionada,
      ordem,
      created_at
    `)
    .eq(
      'ensaio_id',
      ensaio.id
    )
    .order(
      'ordem',
      {
        ascending: true,
        nullsFirst: false
      }
    );

  if (error) {

    console.error(
      'ADMIN V2: erro ao carregar fotos:',
      error
    );

    detail.innerHTML = `
      <p class="msg erro">
        Erro ao carregar fotos:
        ${escaparHTML(error.message)}
      </p>
    `;

    return;
  }

  const todas =
    fotos || [];

  const provas =
    todas.filter(
      foto =>
        foto.tipo === 'prova'
    );

  const finais =
    todas.filter(
      foto =>
        foto.tipo === 'final'
    );

  const selecionadas =
    provas.filter(
      foto =>
        foto.selecionada === true
    );

  detail.innerHTML =
    detalhesHTML(
      ensaio,
      provas,
      finais,
      selecionadas
    );

  configurarDetalhes(
    ensaio
  );
}


// ============================================================
// HTML DETALHES
// ============================================================

function detalhesHTML(
  ensaio,
  provas,
  finais,
  selecionadas
) {

  const linkCliente =
    `${location.origin}/area-cliente`;

  const htmlProvas =
    provas.length

      ? provas
          .map(
            foto =>
              `
              <div
                class="photo-mini ${
                  foto.selecionada
                    ? 'selecionada'
                    : ''
                }"
                title="${
                  foto.selecionada
                    ? 'Selecionada pela cliente'
                    : 'Não selecionada'
                }"
              >

                <img
                  src="${escaparHTML(
                    foto.url
                  )}"
                  alt="Foto de prova"
                  loading="lazy"
                >

              </div>
              `
          )
          .join('')

      : `
        <p class="msg">
          Nenhuma prova enviada ainda.
        </p>
      `;

  const htmlFinais =
    finais.length

      ? finais
          .map(
            foto =>
              `
              <div class="photo-mini">

                <img
                  src="${escaparHTML(
                    foto.url
                  )}"
                  alt="Foto final"
                  loading="lazy"
                >

              </div>
              `
          )
          .join('')

      : `
        <p class="msg">
          Nenhuma foto final enviada ainda.
        </p>
      `;

  return `

    <p class="footer-mono">
      Dados para acesso da cliente:
    </p>

    <div style="margin:10px 0;">

      <p
        class="footer-mono"
        style="margin-bottom:4px;"
      >
        Link da Área do Cliente
      </p>

      <div class="link-box">
        ${escaparHTML(
          linkCliente
        )}
      </div>

    </div>

    <div style="margin:10px 0;">

      <p
        class="footer-mono"
        style="margin-bottom:4px;"
      >
        Login
      </p>

      <div class="link-box">
        ${escaparHTML(
          ensaio.slug
        )}
      </div>

    </div>

    <div style="margin:10px 0;">

      <p
        class="footer-mono"
        style="margin-bottom:4px;"
      >
        Senha
      </p>

      <div class="link-box">
        ${escaparHTML(
          ensaio.codigo_acesso
        )}
      </div>

    </div>

    <button
      type="button"
      class="small-btn"
      id="btn-copiar-${ensaio.id}"
    >
      Copiar dados de acesso
    </button>


    <!-- ================================================= -->
    <!-- PROVAS -->
    <!-- ================================================= -->

    <p
      class="footer-mono"
      style="margin-top:24px;"
    >
      Fotos para a cliente escolher
      (provas)
      —
      ${provas.length}
      enviadas,
      ${selecionadas.length}
      selecionadas:
    </p>

    <div class="upload-area">

      <input
        type="file"
        id="upload-prova-${ensaio.id}"
        multiple
        accept="image/jpeg,image/png,image/webp"
      >

      <p
        class="footer-mono"
        style="margin-top:8px;"
      >
        Selecione uma ou várias fotos.
      </p>

    </div>

    <div
      class="photo-mini-grid"
      id="grid-prova-${ensaio.id}"
    >
      ${htmlProvas}
    </div>


    <!-- ================================================= -->
    <!-- FINAIS -->
    <!-- ================================================= -->

    <p
      class="footer-mono"
      style="margin-top:24px;"
    >
      Fotos finais
      —
      ${finais.length}
      enviadas:
    </p>

    <div class="upload-area">

      <input
        type="file"
        id="upload-final-${ensaio.id}"
        multiple
        accept="image/jpeg,image/png,image/webp"
      >

      <p
        class="footer-mono"
        style="margin-top:8px;"
      >
        Fotos finais para entrega.
      </p>

    </div>

    <div
      class="photo-mini-grid"
      id="grid-final-${ensaio.id}"
    >
      ${htmlFinais}
    </div>


    <!-- ================================================= -->
    <!-- AÇÕES -->
    <!-- ================================================= -->

    <div
      style="
        margin-top:20px;
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      "
    >

      <button
        type="button"
        class="btn ${
          ensaio.status === 'entregue'
            ? ''
            : 'btn-accent'
        }"
        id="btn-entregar-${ensaio.id}"
      >
        ${
          ensaio.status === 'entregue'
            ? 'Já entregue ✓'
            : 'Marcar como entregue'
        }
      </button>

      <button
        type="button"
        class="btn"
        id="btn-excluir-${ensaio.id}"
        style="border-color:#8c877e;"
      >
        Excluir permanentemente
      </button>

    </div>

    <p
      class="msg"
      id="msg-${ensaio.id}"
    ></p>

  `;
}


// ============================================================
// CONFIGURAR DETALHES
// ============================================================

function configurarDetalhes(
  ensaio
) {

  const uploadProva =
    document.getElementById(
      `upload-prova-${ensaio.id}`
    );

  const uploadFinal =
    document.getElementById(
      `upload-final-${ensaio.id}`
    );

  const btnCopiar =
    document.getElementById(
      `btn-copiar-${ensaio.id}`
    );

  const btnEntregar =
    document.getElementById(
      `btn-entregar-${ensaio.id}`
    );

  const btnExcluir =
    document.getElementById(
      `btn-excluir-${ensaio.id}`
    );

  if (uploadProva) {

    uploadProva.addEventListener(
      'change',
      event =>
        uploadFotos(
          event,
          ensaio,
          'prova'
        )
    );
  }

  if (uploadFinal) {

    uploadFinal.addEventListener(
      'change',
      event =>
        uploadFotos(
          event,
          ensaio,
          'final'
        )
    );
  }

  if (btnCopiar) {

    btnCopiar.addEventListener(
      'click',
      () =>
        copiarAcesso(
          ensaio,
          btnCopiar
        )
    );
  }

  if (btnEntregar) {

    btnEntregar.addEventListener(
      'click',
      () =>
        marcarEntregue(
          ensaio
        )
    );
  }

  if (btnExcluir) {

    btnExcluir.addEventListener(
      'click',
      () =>
        excluirEnsaio(
          ensaio
        )
    );
  }
}


// ============================================================
// COPIAR ACESSO
// ============================================================

async function copiarAcesso(
  ensaio,
  botao
) {

  const texto =
`Acesse em: ${location.origin}/area-cliente
Login: ${ensaio.slug}
Senha: ${ensaio.codigo_acesso}`;

  try {

    await navigator.clipboard.writeText(
      texto
    );

    const textoOriginal =
      botao.textContent;

    botao.textContent =
      'Copiado!';

    setTimeout(
      () => {

        botao.textContent =
          textoOriginal;

      },
      2000
    );

  } catch (error) {

    console.error(
      'ADMIN V2: erro ao copiar:',
      error
    );

    mostrarMensagem(
      document.getElementById(
        `msg-${ensaio.id}`
      ),
      'Não foi possível copiar os dados.',
      'erro'
    );
  }
}


// ============================================================
// UPLOAD DE FOTOS
// ============================================================

async function uploadFotos(
  event,
  ensaio,
  tipo
) {

  const arquivos =
    Array.from(
      event.target.files || []
    );

  if (!arquivos.length) {
    return;
  }

  const mensagem =
    document.getElementById(
      `msg-${ensaio.id}`
    );

  mostrarMensagem(
    mensagem,
    `Iniciando upload de ${arquivos.length} foto(s)...`
  );

  let enviadas = 0;
  let erros = 0;

  for (
    let i = 0;
    i < arquivos.length;
    i++
  ) {

    const arquivo =
      arquivos[i];

    try {

      console.log(
        '================================'
      );

      console.log(
        'ADMIN V2 — UPLOAD'
      );

      console.log(
        'Ensaio:',
        ensaio.id
      );

      console.log(
        'Tipo:',
        tipo
      );

      console.log(
        'Arquivo:',
        arquivo.name
      );

      console.log(
        'Tamanho:',
        arquivo.size
      );

      console.log(
        'Tipo MIME:',
        arquivo.type
      );


      // ------------------------------------------------------
      // SESSÃO
      // ------------------------------------------------------

      const {
        data: sessionData,
        error: sessionError
      } =
        await supabase.auth.getSession();

      console.log(
        'Sessão:',
        sessionData?.session
          ? 'AUTENTICADO'
          : 'NÃO AUTENTICADO'
      );

      if (sessionError) {

        throw sessionError;
      }

      if (!sessionData?.session) {

        throw new Error(
          'Usuário não está autenticado no Supabase.'
        );
      }


      // ------------------------------------------------------
      // CAMINHO
      // ------------------------------------------------------

      const nomeSeguro =
        nomeArquivoSeguro(
          arquivo.name
        );

      const identificador =
        `${Date.now()}-${crypto.randomUUID()}`;

      const caminho =
        `${ensaio.id}/${tipo}/${identificador}-${nomeSeguro}`;

      console.log(
        'Caminho Storage:',
        caminho
      );


      // ------------------------------------------------------
      // UPLOAD STORAGE
      // ------------------------------------------------------

      mostrarMensagem(
        mensagem,
        `Enviando foto ${i + 1} de ${arquivos.length}...`
      );

      const {
        data: uploadData,
        error: uploadError
      } =
        await supabase
          .storage
          .from('fotos')
          .upload(
            caminho,
            arquivo,
            {
              cacheControl: '3600',
              upsert: false,
              contentType:
                arquivo.type
            }
          );

      console.log(
        'Resultado Storage:',
        uploadData
      );

      console.log(
        'Erro Storage:',
        uploadError
      );

      if (uploadError) {

        console.error(
          'UPLOAD STORAGE FALHOU:',
          uploadError
        );

        throw new Error(
          `Storage: ${uploadError.message}`
        );
      }


      // ------------------------------------------------------
      // URL
      // ------------------------------------------------------

      const {
        data: urlData
      } =
        supabase
          .storage
          .from('fotos')
          .getPublicUrl(
            caminho
          );

      console.log(
        'URL:',
        urlData?.publicUrl
      );

      if (!urlData?.publicUrl) {

        throw new Error(
          'Supabase não retornou uma URL pública.'
        );
      }


      // ------------------------------------------------------
      // INSERT NA TABELA FOTOS
      // ------------------------------------------------------

      const {
        data: fotoData,
        error: fotoError
      } =
        await supabase
          .from('fotos')
          .insert({

            ensaio_id:
              ensaio.id,

            url:
              urlData.publicUrl,

            tipo:
              tipo,

            selecionada:
              false,

            ordem:
              Date.now()

          })
          .select()
          .single();

      console.log(
        'Registro criado em fotos:',
        fotoData
      );

      console.log(
        'Erro tabela fotos:',
        fotoError
      );

      if (fotoError) {

        console.error(
          'INSERT NA TABELA FOTOS FALHOU:',
          fotoError
        );

        // Remove o arquivo do Storage
        // se o banco falhar.

        await supabase
          .storage
          .from('fotos')
          .remove([
            caminho
          ]);

        throw new Error(
          `Banco fotos: ${fotoError.message}`
        );
      }

      enviadas++;

      console.log(
        'FOTO COMPLETA:',
        arquivo.name
      );

    } catch (error) {

      erros++;

      console.error(
        'ERRO FINAL DA FOTO:',
        error
      );

      mostrarMensagem(
        mensagem,
        `Erro na foto "${arquivo.name}": ${error.message}`,
        'erro'
      );
    }
  }

  // Limpar input
  event.target.value = '';


  // ----------------------------------------------------------
  // RESULTADO
  // ----------------------------------------------------------

  if (erros === 0) {

    mostrarMensagem(
      mensagem,
      `${enviadas} foto(s) enviada(s) com sucesso!`,
      'sucesso'
    );

  } else if (enviadas > 0) {

    mostrarMensagem(
      mensagem,
      `${enviadas} enviada(s) e ${erros} com erro.`,
      'erro'
    );

  } else {

    mostrarMensagem(
      mensagem,
      'Nenhuma foto foi enviada. Verifique o Console do navegador.',
      'erro'
    );
  }


  // Atualizar ensaio
  await atualizarDetalheEnsaio(
    ensaio
  );
}


// ============================================================
// MARCAR COMO ENTREGUE
// ============================================================

async function marcarEntregue(
  ensaio
) {

  const mensagem =
    document.getElementById(
      `msg-${ensaio.id}`
    );

  if (
    ensaio.status ===
    'entregue'
  ) {

    return;
  }

  const confirmar =
    window.confirm(
      `Marcar "${ensaio.titulo}" como entregue?`
    );

  if (!confirmar) {
    return;
  }

  mostrarMensagem(
    mensagem,
    'Atualizando ensaio...'
  );

  const {
    error
  } =
    await supabase
      .from('ensaios')
      .update({

        status:
          'entregue'

      })
      .eq(
        'id',
        ensaio.id
      );

  if (error) {

    console.error(
      'ADMIN V2: erro ao marcar entregue:',
      error
    );

    mostrarMensagem(
      mensagem,
      'Erro: ' +
      error.message,
      'erro'
    );

    return;
  }

  mostrarMensagem(
    mensagem,
    'Ensaio marcado como entregue!',
    'sucesso'
  );

  await carregarEnsaios();
}


// ============================================================
// APAGAR ARQUIVOS DO STORAGE
// ============================================================

async function apagarArquivosStorage(
  ensaioId
) {

  for (
    const tipo of [
      'prova',
      'final'
    ]
  ) {

    const pasta =
      `${ensaioId}/${tipo}`;

    const {
      data: arquivos,
      error
    } =
      await supabase
        .storage
        .from('fotos')
        .list(
          pasta,
          {
            limit: 1000
          }
        );

    if (error) {

      console.error(
        `ADMIN V2: erro ao listar ${pasta}:`,
        error
      );

      continue;
    }

    if (
      !arquivos ||
      !arquivos.length
    ) {

      continue;
    }

    const caminhos =
      arquivos
        .filter(
          arquivo =>
            arquivo.name
        )
        .map(
          arquivo =>
            `${pasta}/${arquivo.name}`
        );

    if (!caminhos.length) {
      continue;
    }

    const {
      error: removeError
    } =
      await supabase
        .storage
        .from('fotos')
        .remove(
          caminhos
        );

    if (removeError) {

      console.error(
        `ADMIN V2: erro ao apagar arquivos de ${pasta}:`,
        removeError
      );
    }
  }
}


// ============================================================
// EXCLUIR ENSAIO
// ============================================================

async function excluirEnsaio(
  ensaio
) {

  const confirmar =
    window.confirm(
      `Tem certeza que deseja excluir "${ensaio.titulo}"?\n\n` +
      `Isso apagará o ensaio, as fotos de prova e as fotos finais.\n\n` +
      `Esta ação não pode ser desfeita.`
    );

  if (!confirmar) {
    return;
  }

  const mensagem =
    document.getElementById(
      `msg-${ensaio.id}`
    );

  mostrarMensagem(
    mensagem,
    'Excluindo ensaio...'
  );


  // ----------------------------------------------------------
  // STORAGE
  // ----------------------------------------------------------

  await apagarArquivosStorage(
    ensaio.id
  );


  // ----------------------------------------------------------
  // BANCO — FOTOS
  // ----------------------------------------------------------

  const {
    error: fotosError
  } =
    await supabase
      .from('fotos')
      .delete()
      .eq(
        'ensaio_id',
        ensaio.id
      );

  if (fotosError) {

    console.error(
      'ADMIN V2: erro ao apagar fotos:',
      fotosError
    );

    mostrarMensagem(
      mensagem,
      'Erro ao apagar as fotos: ' +
      fotosError.message,
      'erro'
    );

    return;
  }


  // ----------------------------------------------------------
  // BANCO — ENSAIO
  // ----------------------------------------------------------

  const {
    error: ensaioError
  } =
    await supabase
      .from('ensaios')
      .delete()
      .eq(
        'id',
        ensaio.id
      );

  if (ensaioError) {

    console.error(
      'ADMIN V2: erro ao apagar ensaio:',
      ensaioError
    );

    mostrarMensagem(
      mensagem,
      'Erro ao apagar ensaio: ' +
      ensaioError.message,
      'erro'
    );

    return;
  }

  console.log(
    'ADMIN V2: ensaio excluído:',
    ensaio.id
  );

  await carregarEnsaios();
}


// ============================================================
// EVENTOS
// ============================================================

function configurarEventos() {

  // ----------------------------------------------------------
  // LOGIN
  // ----------------------------------------------------------

  if (loginForm) {

    loginForm.addEventListener(
      'submit',
      fazerLogin
    );
  }


  // ----------------------------------------------------------
  // LOGOUT
  // ----------------------------------------------------------

  const btnLogout =
    document.getElementById(
      'logout-btn'
    ) ||
    document.getElementById(
      'btn-logout'
    );

  if (btnLogout) {

    btnLogout.addEventListener(
      'click',
      fazerLogout
    );
  }


  // ----------------------------------------------------------
  // NOVO ENSAIO
  // ----------------------------------------------------------

  const formNovoEnsaio =
    document.getElementById(
      'form-novo-ensaio'
    );

  if (formNovoEnsaio) {

    formNovoEnsaio.addEventListener(
      'submit',
      criarEnsaio
    );
  }


  // ----------------------------------------------------------
  // GERADORES
  // ----------------------------------------------------------

  configurarGeradores();
}


// ============================================================
// INICIALIZAÇÃO
// ============================================================

async function iniciarAdmin() {

  console.log(
    'ADMIN V2: iniciando painel...'
  );

  configurarEventos();

  await verificarSessao();

  console.log(
    'ADMIN V2: painel inicializado.'
  );
}


// ============================================================
// DOM READY
// ============================================================

if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    iniciarAdmin
  );

} else {

  iniciarAdmin();

}
