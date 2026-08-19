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


// ============================================
// DESIGN PUBLICADO PELO ADMIN V2
// ============================================

const PUBLIC_DESIGN_DEFAULTS = {
  nav_style:'auto',
  nav_position:'fixed',
  nav_density:'normal',
  logo_scale:100,
  nav_cta:'outline',
  nav_blur:0,
  page_animation:'none',
  section_animation:'none',
  image_hover:'site',
  motion_speed:'normal',
  type_scale:100,
  content_width:1200,
  section_space:120,
  hero_overlay:40,
  gallery_gap:2,
  image_radius:0,
  client_layout:'editorial-split',
  client_gallery_style:'editorial',
  client_photo_size:'large',
  client_typography:'classic',
  client_border:'fine',
  client_access_image:'',
  client_focus_x:50,
  client_focus_y:50,
  client_text_visual:'Retratos guardados com cuidado.\nUm espaço reservado só para você.',
  client_text_eyebrow:'Área privada',
  client_text_title:'Sua sessão,',
  client_text_title_emphasis:'em um espaço só seu.',
  client_text_description:'Acesse sua galeria para selecionar fotografias, acompanhar a edição e receber seus arquivos finais.',
  client_text_login:'Login',
  client_text_password:'Senha',
  client_text_button:'Acessar minha galeria',
  client_text_secure:'Acesso privado e protegido',
  client_text_gallery_eyebrow:'Sua experiência',
  client_stage_selection:'Seleção',
  client_stage_selection_sub:'Escolha',
  client_stage_editing:'Edição',
  client_stage_editing_sub:'Tratamento',
  client_stage_delivery:'Entrega',
  client_stage_delivery_sub:'Final',
  client_status_preparing:'Suas fotos estão sendo preparadas',
  client_status_awaiting:'Escolha suas fotos favoritas',
  client_status_selected:'Seleção enviada — aguardando edição',
  client_status_editing:'Suas fotografias estão em edição',
  client_status_ready:'Suas fotos estão prontas!'
};

function publicDesignClamp(value,min,max,fallback){
  const n=Number(value);
  if(!Number.isFinite(n)) return fallback;
  return Math.min(max,Math.max(min,n));
}

function normalizePublicDesign(config={}){
  const c={...PUBLIC_DESIGN_DEFAULTS,...(config||{})};
  return {
    ...c,
    logo_scale:publicDesignClamp(c.logo_scale,85,120,100),
    nav_blur:publicDesignClamp(c.nav_blur,0,18,0),
    type_scale:publicDesignClamp(c.type_scale,90,115,100),
    content_width:publicDesignClamp(c.content_width,1040,1500,1200),
    section_space:publicDesignClamp(c.section_space,72,160,120),
    hero_overlay:publicDesignClamp(c.hero_overlay,0,70,40),
    gallery_gap:publicDesignClamp(c.gallery_gap,0,16,2),
    image_radius:publicDesignClamp(c.image_radius,0,18,0),
    client_layout:['editorial-split','centered','fullscreen'].includes(c.client_layout)?c.client_layout:'editorial-split',
    client_gallery_style:['editorial','clean','masonry'].includes(c.client_gallery_style)?c.client_gallery_style:'editorial',
    client_photo_size:['compact','medium','large'].includes(c.client_photo_size)?c.client_photo_size:'large',
    client_typography:['classic','editorial','minimal'].includes(c.client_typography)?c.client_typography:'classic',
    client_border:['fine','none','soft'].includes(c.client_border)?c.client_border:'fine',
    client_access_image:typeof c.client_access_image==='string'?c.client_access_image.trim():'',
    client_focus_x:publicDesignClamp(c.client_focus_x,0,100,50),
    client_focus_y:publicDesignClamp(c.client_focus_y,0,100,50),
    client_text_visual:typeof c.client_text_visual==='string'?c.client_text_visual:PUBLIC_DESIGN_DEFAULTS.client_text_visual,
    client_text_eyebrow:typeof c.client_text_eyebrow==='string'?c.client_text_eyebrow:PUBLIC_DESIGN_DEFAULTS.client_text_eyebrow,
    client_text_title:typeof c.client_text_title==='string'?c.client_text_title:PUBLIC_DESIGN_DEFAULTS.client_text_title,
    client_text_title_emphasis:typeof c.client_text_title_emphasis==='string'?c.client_text_title_emphasis:PUBLIC_DESIGN_DEFAULTS.client_text_title_emphasis,
    client_text_description:typeof c.client_text_description==='string'?c.client_text_description:PUBLIC_DESIGN_DEFAULTS.client_text_description,
    client_text_login:typeof c.client_text_login==='string'?c.client_text_login:PUBLIC_DESIGN_DEFAULTS.client_text_login,
    client_text_password:typeof c.client_text_password==='string'?c.client_text_password:PUBLIC_DESIGN_DEFAULTS.client_text_password,
    client_text_button:typeof c.client_text_button==='string'?c.client_text_button:PUBLIC_DESIGN_DEFAULTS.client_text_button,
    client_text_secure:typeof c.client_text_secure==='string'?c.client_text_secure:PUBLIC_DESIGN_DEFAULTS.client_text_secure,
    client_text_gallery_eyebrow:typeof c.client_text_gallery_eyebrow==='string'?c.client_text_gallery_eyebrow:PUBLIC_DESIGN_DEFAULTS.client_text_gallery_eyebrow,
    client_stage_selection:typeof c.client_stage_selection==='string'?c.client_stage_selection:PUBLIC_DESIGN_DEFAULTS.client_stage_selection,
    client_stage_selection_sub:typeof c.client_stage_selection_sub==='string'?c.client_stage_selection_sub:PUBLIC_DESIGN_DEFAULTS.client_stage_selection_sub,
    client_stage_editing:typeof c.client_stage_editing==='string'?c.client_stage_editing:PUBLIC_DESIGN_DEFAULTS.client_stage_editing,
    client_stage_editing_sub:typeof c.client_stage_editing_sub==='string'?c.client_stage_editing_sub:PUBLIC_DESIGN_DEFAULTS.client_stage_editing_sub,
    client_stage_delivery:typeof c.client_stage_delivery==='string'?c.client_stage_delivery:PUBLIC_DESIGN_DEFAULTS.client_stage_delivery,
    client_stage_delivery_sub:typeof c.client_stage_delivery_sub==='string'?c.client_stage_delivery_sub:PUBLIC_DESIGN_DEFAULTS.client_stage_delivery_sub,
    client_status_preparing:typeof c.client_status_preparing==='string'?c.client_status_preparing:PUBLIC_DESIGN_DEFAULTS.client_status_preparing,
    client_status_awaiting:typeof c.client_status_awaiting==='string'?c.client_status_awaiting:PUBLIC_DESIGN_DEFAULTS.client_status_awaiting,
    client_status_selected:typeof c.client_status_selected==='string'?c.client_status_selected:PUBLIC_DESIGN_DEFAULTS.client_status_selected,
    client_status_editing:typeof c.client_status_editing==='string'?c.client_status_editing:PUBLIC_DESIGN_DEFAULTS.client_status_editing,
    client_status_ready:typeof c.client_status_ready==='string'?c.client_status_ready:PUBLIC_DESIGN_DEFAULTS.client_status_ready
  };
}


function applyPublishedClientTexts(c){
  const setText=(selector,value)=>{
    const el=document.querySelector(selector);
    if(el) el.textContent=value??'';
  };

  setText('#client-visual-text',c.client_text_visual);
  setText('#client-access-eyebrow',c.client_text_eyebrow);
  setText('#client-access-title-main',c.client_text_title);
  setText('#client-access-title-emphasis',c.client_text_title_emphasis);
  setText('#client-access-description',c.client_text_description);
  setText('#client-login-label',c.client_text_login);
  setText('#client-password-label',c.client_text_password);
  setText('#client-access-submit',c.client_text_button);
  setText('#client-access-secure-text',c.client_text_secure);
  setText('#client-gallery-eyebrow',c.client_text_gallery_eyebrow);
  setText('#client-stage-selection',c.client_stage_selection);
  setText('#client-stage-selection-sub',c.client_stage_selection_sub);
  setText('#client-stage-editing',c.client_stage_editing);
  setText('#client-stage-editing-sub',c.client_stage_editing_sub);
  setText('#client-stage-delivery',c.client_stage_delivery);
  setText('#client-stage-delivery-sub',c.client_stage_delivery_sub);

  window.__CLIENT_DESIGN_TEXTS__={
    status_preparing:c.client_status_preparing,
    status_awaiting:c.client_status_awaiting,
    status_selected:c.client_status_selected,
    status_editing:c.client_status_editing,
    status_ready:c.client_status_ready
  };
}

function applyPublishedDesign(config={}){
  const c=normalizePublicDesign(config);
  let style=document.getElementById('published-design-style');
  if(!style){
    style=document.createElement('style');
    style.id='published-design-style';
    document.head.appendChild(style);
  }

  const navPadding=c.nav_density==='compact'?14:c.nav_density==='airy'?30:22;
  const navSolid=c.nav_density==='compact'?10:c.nav_density==='airy'?22:16;
  const motionMs=c.motion_speed==='fast'?280:c.motion_speed==='slow'?900:520;
  const scale=c.type_scale/100;

  const navStyle=
    c.nav_style==='transparent'
      ? '.nav{background:transparent !important;border-color:transparent !important;}'
      : c.nav_style==='solid'
        ? '.nav{background:rgba(8,8,7,.94) !important;border-color:rgba(255,255,255,.10) !important;}'
        : '';

  const navPosition=
    c.nav_position==='static'
      ? '.nav{position:absolute !important}.nav.is-hidden{transform:none !important;opacity:1 !important;pointer-events:auto !important}'
      : '';

  const cta=
    c.nav_cta==='filled'
      ? '.nav-cta{background:#f3f0e9 !important;color:#0b0b0a !important;border-color:#f3f0e9 !important;}'
      : c.nav_cta==='hidden'
        ? '.nav-cta{display:none !important;}'
        : '';

  const widthRule=
    c.content_width===1200
      ? ''
      : `.container{max-width:${c.content_width}px !important;margin-left:auto !important;margin-right:auto !important;}`;

  const titleRule=
    c.type_scale===100
      ? ''
      : `.hero-title{font-size:clamp(${(2.6*scale).toFixed(3)}rem,${(7*scale).toFixed(3)}vw,${(6*scale).toFixed(3)}rem) !important}
         .section-title{font-size:clamp(${(2.6*scale).toFixed(3)}rem,${(10*scale).toFixed(3)}vw,${(4.4*scale).toFixed(3)}rem) !important}`;

  const hoverRule=
    c.image_hover==='none'
      ? '.frame:hover img{transform:none !important;filter:none !important}.frame:hover{transform:none !important}'
      : c.image_hover==='zoom'
        ? `.frame img{transition:transform ${motionMs}ms ease !important}.frame:hover img{transform:scale(1.07) !important}`
        : c.image_hover==='lift'
          ? `.frame{transition:transform ${motionMs}ms ease,box-shadow ${motionMs}ms ease !important}.frame:hover{transform:translateY(-8px) !important;box-shadow:0 18px 42px rgba(0,0,0,.35) !important}.frame:hover img{transform:none !important}`
          : '';

  const sectionAnim=
    c.section_animation==='fade'
      ? `@keyframes publishedSectionIn{from{opacity:0}to{opacity:1}}.section{animation:publishedSectionIn ${motionMs}ms ease both}`
      : c.section_animation==='fade-up'
        ? `@keyframes publishedSectionIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}.section{animation:publishedSectionIn ${motionMs}ms cubic-bezier(.22,.61,.36,1) both}`
        : '';

  const pageAnim=
    c.page_animation==='fade'
      ? `@keyframes publishedPageIn{from{opacity:0}to{opacity:1}}body{animation:publishedPageIn ${motionMs}ms ease both}`
      : c.page_animation==='fade-up'
        ? `@keyframes publishedPageIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}body{animation:publishedPageIn ${motionMs}ms cubic-bezier(.22,.61,.36,1) both}`
        : c.page_animation==='soft'
          ? `@keyframes publishedPageIn{from{opacity:0;filter:blur(4px);transform:scale(.992)}to{opacity:1;filter:none;transform:none}}body{animation:publishedPageIn ${Math.round(motionMs*1.25)}ms ease both}`
          : '';

  const clientBorderRule =
    c.client_border==='none'
      ? 'border-color:transparent !important;'
      : c.client_border==='soft'
        ? 'border-color:rgba(255,255,255,.16) !important;border-radius:14px !important;'
        : 'border-color:rgba(255,255,255,.10) !important;';

  const clientColumns =
    c.client_photo_size==='compact'
      ? 'repeat(auto-fill,minmax(180px,1fr))'
      : c.client_photo_size==='medium'
        ? 'repeat(auto-fill,minmax(230px,1fr))'
        : 'repeat(auto-fill,minmax(290px,1fr))';

  const clientTypographyRule =
    c.client_typography==='editorial'
      ? '.client-area-premium .section-title,.client-area-premium .client-access-title{font-style:italic !important;letter-spacing:-.035em !important;}'
      : c.client_typography==='minimal'
        ? '.client-area-premium .section-title,.client-area-premium .client-access-title{font-family:Arial,Helvetica,sans-serif !important;font-style:normal !important;font-weight:400 !important;letter-spacing:-.025em !important;}'
        : '';

  const clientLayoutRule =
    c.client_layout==='centered'
      ? '.client-access-shell{grid-template-columns:1fr !important;max-width:650px !important}.client-access-visual{display:none !important}.client-access-panel{min-height:70vh !important;}'
      : c.client_layout==='fullscreen'
        ? '.client-access-shell{grid-template-columns:1fr !important;max-width:none !important}.client-access-visual{display:block !important;position:absolute !important;inset:0 !important;opacity:.36 !important}.client-access-panel{position:relative !important;z-index:2 !important;max-width:620px !important;margin:auto !important;background:rgba(11,11,10,.78) !important;backdrop-filter:blur(14px) !important;}'
        : '';

  const clientGalleryRule =
    c.client_gallery_style==='masonry'
      ? '.client-gallery-grid{display:block !important;columns:3 260px !important;column-gap:10px !important}.client-gallery-grid .frame{break-inside:avoid !important;margin:0 0 10px !important;}'
      : `.client-gallery-grid{display:grid !important;grid-template-columns:${clientColumns} !important;gap:${c.client_gallery_style==='clean'?16:8}px !important;}`;

  style.textContent=`
    ${widthRule}
    ${titleRule}
    ${navStyle}
    ${navPosition}
    ${cta}
    ${hoverRule}
    ${sectionAnim}
    ${pageAnim}
    .section{padding-top:${c.section_space}px !important;padding-bottom:${c.section_space}px !important}
    .grid{gap:${c.gallery_gap}px !important}
    .frame,.frame img{border-radius:${c.image_radius}px !important}
    .nav{padding-top:${navPadding}px !important;padding-bottom:${navPadding}px !important;backdrop-filter:blur(${c.nav_blur}px) !important;-webkit-backdrop-filter:blur(${c.nav_blur}px) !important}
    .nav.is-solid{padding-top:${navSolid}px !important;padding-bottom:${navSolid}px !important}
    .nav-logo{transform:scale(${(c.logo_scale/100).toFixed(3)}) !important;transform-origin:left center !important}
    .hero-overlay{opacity:${(c.hero_overlay/100).toFixed(2)} !important}
    .client-area-premium .client-access-shell,
    .client-area-premium .client-access-panel,
    .client-area-premium .client-access-visual,
    .client-area-premium .client-stage-card,
    .client-area-premium .frame{
      ${clientBorderRule}
    }

    ${clientTypographyRule}
    ${clientLayoutRule}
    ${clientGalleryRule}

    .client-access-visual{
      ${c.client_access_image ? `background-image:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.34)),url("${c.client_access_image.replace(/"/g,'%22')}") !important;` : ''}
      background-position:${c.client_focus_x}% ${c.client_focus_y}% !important;
    }

    @media (prefers-reduced-motion:reduce){body,.section{animation:none !important}}
  `;

  applyPublishedClientTexts(c);
}

async function loadPublishedDesign(){
  try{
    const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const {SUPABASE_URL,SUPABASE_ANON_KEY}=await import('./supabase-config.js');
    const designSupabase=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{
      auth:{persistSession:false,autoRefreshToken:false}
    });

    const {data,error}=await designSupabase
      .from('site_content')
      .select('content')
      .eq('slug','design')
      .eq('section_key','published')
      .limit(1)
      .maybeSingle();

    if(error){
      console.warn('Design público: não foi possível carregar:',error.message);
      return;
    }
    if(!data?.content) return;

    let content=data.content;
    if(typeof content==='string'){
      try{content=JSON.parse(content);}catch(_){content={};}
    }
    applyPublishedDesign(content);
  }catch(error){
    console.warn('Design público: falha silenciosa:',error);
  }
}

loadPublishedDesign();
