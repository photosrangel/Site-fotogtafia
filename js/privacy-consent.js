(function(){
  const siteColumn=[...document.querySelectorAll('.footer-column')].find(el=>el.querySelector('.footer-label')?.textContent.trim()==='Site');
  if(siteColumn&&!siteColumn.querySelector('a[href="/privacidade"]'))siteColumn.insertAdjacentHTML('beforeend','<a href="/privacidade">Privacidade</a><a href="/termos">Termos</a>');
  const KEY='rangel-consent-v1';
  const consent=localStorage.getItem(KEY);
  window.rangelConsent={analytics:consent==='accepted'};
  window.dispatchEvent(new CustomEvent('rangel:consent',{detail:window.rangelConsent}));
  if(consent)return;
  const box=document.createElement('aside');
  box.className='cookie-consent';box.setAttribute('role','dialog');box.setAttribute('aria-label','Consentimento de cookies');
  box.innerHTML='<p><strong>Privacidade e cookies</strong><br>Usamos apenas cookies essenciais por padrão. Estatísticas opcionais só serão ativadas com a sua autorização. <a href="/privacidade">Política de Privacidade</a>.</p><div><button class="btn" data-consent="essential">Só essenciais</button><button class="btn btn-accent" data-consent="accepted">Aceitar estatísticas</button></div>';
  box.addEventListener('click',e=>{const value=e.target?.dataset?.consent;if(!value)return;localStorage.setItem(KEY,value);window.rangelConsent={analytics:value==='accepted'};window.dispatchEvent(new CustomEvent('rangel:consent',{detail:window.rangelConsent}));box.remove()});
  document.body.append(box);
})();
