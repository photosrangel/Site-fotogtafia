// ============================================
// JS compartilhado por todas as páginas do site
// ============================================

// Nav fica sólida ao rolar a página
const nav = document.querySelector('.nav');
if (nav) {
  const onScroll = () => {
    if (window.scrollY > 40) nav.classList.add('is-solid');
    else nav.classList.remove('is-solid');
  };
  window.addEventListener('scroll', onScroll);
  onScroll();
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
