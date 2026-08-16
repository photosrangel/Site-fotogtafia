// ============================================
// JS compartilhado por todas as páginas do site
// ============================================

// Bloqueia o menu de botão direito ("Salvar imagem como...") e o
// "arrastar para salvar" em qualquer foto do site — proteção básica
// contra download fácil das fotos da galeria pública.
document.addEventListener('contextmenu', (e) => {
  if (e.target.tagName === 'IMG') e.preventDefault();
});
document.addEventListener('dragstart', (e) => {
  if (e.target.tagName === 'IMG') e.preventDefault();
});

// Nav fica sólida ao rolar, e some/aparece conforme a cliente rola a tela
const nav = document.querySelector('.nav');
if (nav) {
  let navTimeout = null;

  const atualizarFundoSolido = () => {
    if (window.scrollY > 40) nav.classList.add('is-solid');
    else nav.classList.remove('is-solid');
  };
  atualizarFundoSolido(); // só ajusta o fundo, sem esconder, ao carregar a página

  window.addEventListener('scroll', () => {
    atualizarFundoSolido();
    nav.classList.add('is-hidden');
    clearTimeout(navTimeout);
    navTimeout = setTimeout(() => {
      nav.classList.remove('is-hidden');
    }, 500);
  });
}

// Menu mobile (hambúrguer)
const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');
if (toggle && links) {
  toggle.addEventListener('click', () => {
    links.classList.toggle('is-open');
  });
  links.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => links.classList.remove('is-open'))
  );
}

// O filtro e a renderização da galeria por ensaio agora ficam em js/gallery.js
// (carregado apenas na página galeria.html)
