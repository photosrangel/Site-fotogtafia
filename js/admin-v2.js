// ============================================================
// ADMIN V2 — RANGEL SANTOS FOTOGRAFIA
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
// ELEMENTOS PRINCIPAIS
// ============================================================

const loginScreen =
  document.getElementById('login-screen');

const painel =
  document.getElementById('painel');

const loginForm =
  document.getElementById('login-form');

const loginMsg =
  document.getElementById('login-msg');

const listaEnsaios =
  document.getElementById('lista-ensaios');


// ============================================================
// ESTADO
// ============================================================

let detalheAberto = null;


// ============================================================
// UTILITÁRIOS
// ============================================================

function mostrarMensagem(elemento, texto, tipo = '') {

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
    document.getElementById('login-email')
      .value
      .trim();

  const senha =
    document.getElementById('login-senha')
      .value;

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

    loginScreen.style.display =
      'none';

  }


  if (painel) {

    painel.style.display =
      'block';

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

        document.getElementById(
          'novo-login'
        ).value =
          gerarLogin();

      }
    );

  }


  if (btnCodigo) {

    btnCodigo.addEventListener(
      'click',
      () => {

        document.getElementById(
          'novo-codigo'
        ).value =
          gerarSenha();

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
    ).value
    .trim();


  const clienteNome =
    document.getElementById(
      'novo-cliente'
    ).value
    .trim();


  const categoria =
    document.getElementById(
      'novo-categoria'
    ).value;


  const loginOriginal =
    document.getElementById(
      'novo-login'
    ).value;


  const codigo =
    document.getElementById(
      'novo-codigo'
    ).value
    .trim();


  const slug =
    limparLogin(loginOriginal);


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

      categoria,

      codigo_acesso:
        codigo,

      slug,

      status:
        'aguardando'

    });


  if (error) {

    console.error(
      'ADMIN V2: erro ao criar ensaio:',
      error
    );


    if (
      error.message
        ?.toLowerCase()
        .includes('duplicate')
      ||
      error.message
        ?.toLowerCase()
        .includes('unique')
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

  if (!listaEnsaios) {

    console.error(
      'ADMIN V2: #lista-ensaios não encontrado.'
    );

    return;

  }


  listaEnsaios.innerHTML = `
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


    listaEnsaios.innerHTML = `
      <p class="msg erro">
        Erro ao carregar ensaios:
        ${escaparHTML(error.message)}
      </p>
    `;

    return;

  }


  if (!ensaios || ensaios.length === 0) {

    listaEnsaios.innerHTML = `
      <div class="ensaio-card">
        <p class="msg">
          Nenhum ensaio cadastrado ainda.
        </p>
      </div>
    `;

    return;

  }


  listaEnsaios.innerHTML =
    ensaios
      .map(
        ensaioCardHTML
      )
      .join('');


  ensaios.forEach(
    (ensaio) => {

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


  if (status === 'selecionado') {

    return 'Cliente escolheu';

  }


  return 'Aguardando seleção';

}


// ============================================================
// DETALHES DO ENSAIO
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

    detalheAberto =
      null;

    return;

  }


  detail.classList.add(
    'is-open'
  );


  detalheAberto =
    detail;


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
        ${escaparHTML(
          error.message
        )}
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


  detail.innerHTML = detalhesHTML(
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
// HTML DOS DETALHES
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


    <!-- ========================= -->
    <!-- PROVAS -->
    <!-- ========================= -->

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
        accept="image/*"
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


    <!-- ========================= -->
    <!-- FINAIS -->
    <!-- ========================= -->

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
        accept="image/*"
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


    <!-- ========================= -->
    <!-- AÇÕES -->
    <!-- ========================= -->

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

function configurarDetalhes(ensaio) {

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
    `Enviando ${arquivos.length} foto(s)...`
  );


  let enviadas =
    0;

  let erros =
    0;


  for (
    const arquivo
    of arquivos
  ) {

    try {

      const timestamp =
        Date.now();


      const nomeSeguro =
        nomeArquivoSeguro(
          arquivo.name
        );


      const caminho =
        `${ensaio.id}/${tipo}/${timestamp}-${nomeSeguro}`;


      console.log(
        'ADMIN V2: enviando:',
        caminho
      );


      const {
        error: uploadError
      } =
        await supabase
          .storage
          .from('fotos')
          .upload(
            caminho,
            arquivo,
            {
              upsert: false
            }
          );


      if (uploadError) {

        console.error(
          'ADMIN V2: erro no upload:',
          uploadError
        );

        erros++;

        continue;

      }


      const {
        data: urlData
      } =
        supabase
          .storage
          .from('fotos')
          .getPublicUrl(
            caminho
          );


      if (
        !urlData?.publicUrl
      ) {

        console.error(
          'ADMIN V2: URL pública não encontrada.'
        );

        erros++;

        continue;

      }


      const {
        error: insertError
      } =
        await supabase
          .from('fotos')
          .insert({

            ensaio_id:
              ensaio.id,

            url:
              urlData.publicUrl,

            tipo,

            selecionada:
              false,

            ordem:
              Date.now()

          });


      if (insertError) {

        console.error(
          'ADMIN V2: erro ao registrar foto:',
          insertError
        );

        erros++;

        continue;

      }


      enviadas++;


      // Evita colisão de timestamp
      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            5
          )
      );

    } catch (error) {

      console.error(
        'ADMIN V2: erro inesperado:',
        error
      );

      erros++;

    }

  }


  event.target.value =
    '';


  if (erros === 0) {

    mostrarMensagem(
      mensagem,
      `${enviadas} foto(s) enviada(s) com sucesso!`,
      'sucesso'
    );

  } else {

    mostrarMensagem(
      mensagem,
      `${enviadas} enviada(s) e ${erros} com erro.`,
      'erro'
    );

  }


  await carregarEnsaios();

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
    const tipo
    of ['prova', 'final']
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
  // 1. Apagar arquivos do Storage
  // ----------------------------------------------------------

  await apagarArquivosStorage(
    ensaio.id
  );


  // ----------------------------------------------------------
  // 2. Apagar registros das fotos
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
      'ADMIN V2: erro ao apagar fotos do banco:',
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
  // 3. Apagar ensaio
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

  // Login

  if (loginForm) {

    loginForm.addEventListener(
      'submit',
      fazerLogin
    );

  }


  // Logout

  const btnLogout =
    document.getElementById(
      'btn-logout'
    );


  if (btnLogout) {

    btnLogout.addEventListener(
      'click',
      fazerLogout
    );

  }


  // Novo ensaio

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

document.addEventListener(
  'DOMContentLoaded',
  iniciarAdmin
);
