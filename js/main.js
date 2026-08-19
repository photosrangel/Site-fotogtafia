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

// Nav: desaparece suavemente durante a rolagem e reaparece quando ela para.
const nav = document.querySelector('.nav');
if (nav) {
  let navTimeout = null;
  let lastScrollY = window.scrollY;
  let accumulatedScroll = 0;
  const hideThreshold = 12;
  const showDelay = 340;

  const atualizarFundoSolido = () => {
    nav.classList.toggle('is-solid', window.scrollY > 40);
  };

  const mostrarNav = () => {
    nav.classList.remove('is-hidden');
    accumulatedScroll = 0;
  };

  atualizarFundoSolido();

  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    const delta = Math.abs(currentScrollY - lastScrollY);

    atualizarFundoSolido();

    // No topo, a navegação permanece sempre visível.
    if (currentScrollY <= 8) {
      mostrarNav();
      clearTimeout(navTimeout);
      lastScrollY = currentScrollY;
      return;
    }

    // Evita que pequenos movimentos do navegador façam a barra "tremer".
    accumulatedScroll += delta;
    if (accumulatedScroll >= hideThreshold) {
      nav.classList.add('is-hidden');
    }

    clearTimeout(navTimeout);
    navTimeout = setTimeout(mostrarNav, showDelay);
    lastScrollY = currentScrollY;
  }, { passive: true });
}

// Menu mobile (hambúrguer)
const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');
if (toggle && links) {
  toggle.addEventListener('click', () => {
    links.classList.toggle('is-open');
    nav?.classList.remove('is-hidden');
  });
  links.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => links.classList.remove('is-open'))
  );
}

// O filtro e a renderização da galeria por ensaio agora ficam em js/gallery.js
// (carregado apenas na página galeria.html)
