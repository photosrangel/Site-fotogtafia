'use client';

import { useEffect } from 'react';
import type { VisualOverride } from '@/lib/published-design';

type VisualElement = HTMLElement & { __publishedBaseFontSizes?: Record<string, number> };

function scaleFor(override: VisualOverride, mobile = false) {
  const applied = mobile ? { ...override, ...(override.mobile || {}) } : override;
  const legacyScale = applied.size === 'small' ? 86 : applied.size === 'large' ? 114 : 100;
  const rawScale = Number(applied.size_scale ?? legacyScale);
  const maximumScale = mobile ? 160 : 250;
  return Number.isFinite(rawScale) ? Math.max(50, Math.min(maximumScale, rawScale)) : 100;
}

/*
 * O efeito abaixo também é renderizado pelo servidor. Assim, o navegador já
 * recebe o tamanho móvel do título no primeiro quadro e não mostra por alguns
 * instantes o tamanho padrão antes de o JavaScript iniciar.
 */
function initialVisualCss(overrides: Record<string, VisualOverride>) {
  const title = overrides['hero-title'];
  if (!title) return '';
  const scale = scaleFor(title, true) / 100;
  const mobile = { ...title, ...(title.mobile || {}) };
  const declarations = [
    `font-size:clamp(${(2.4 * scale).toFixed(4)}rem,${(11.4 * scale).toFixed(4)}vw,${(3 * scale).toFixed(4)}rem)!important`,
    mobile.bold ? 'font-weight:700!important' : '',
    mobile.italic ? 'font-style:italic!important' : '',
    mobile.align ? `text-align:${mobile.align}!important` : '',
    Number(mobile.x || 0) || Number(mobile.y || 0)
      ? `translate:${Number(mobile.x || 0)}px ${Number(mobile.y || 0)}px!important`
      : '',
  ].filter(Boolean).join(';');
  return `@media(max-width:520px){#hero-title{${declarations}}}`;
}

function getBaseFontSize(element: VisualElement, mobile: boolean) {
  const key = mobile ? 'mobile' : 'desktop';
  element.__publishedBaseFontSizes ||= {};
  if (!element.__publishedBaseFontSizes[key]) {
    const previous = element.style.fontSize;
    element.style.removeProperty('font-size');
    element.__publishedBaseFontSizes[key] = parseFloat(element.ownerDocument.defaultView?.getComputedStyle(element).fontSize || '') || 16;
    element.style.fontSize = previous;
  }
  return element.__publishedBaseFontSizes[key];
}

/*
 * Estes ids têm um campo de conteúdo dedicado (content.hero.*) que já é
 * a fonte da verdade — são publicados diretamente pelo botão "Publicar
 * alterações no site" via publishDesignContent(). Para eles, NUNCA
 * aplicamos o texto vindo de inline_styles aqui: esse texto pode ser
 * uma sobra antiga de uma publicação passada, e sempre priorizá-lo
 * travava o título (e outros campos do hero) mesmo depois de o texto
 * novo já estar salvo corretamente no banco. inline_styles continua
 * controlando o ESTILO desses campos (negrito/itálico/tamanho/
 * alinhamento/posição) normalmente — só o texto é ignorado aqui.
 */
const CONTENT_MANAGED_TEXT_IDS = new Set([
  'hero-title',
  'hero-eyebrow',
  'hero-description',
  'hero-primary-button',
  'hero-secondary-button',
  'recent-work-eyebrow',
  'recent-work-title',
  'recent-work-button',
]);

function applyToDocument(doc: Document, overrides: Record<string, VisualOverride>) {
  if (doc.documentElement?.dataset.designPreviewActive === '1') return;
  for (const [id, override] of Object.entries(overrides)) {
    const element = doc.getElementById(id) as VisualElement | null;
    if (!element) continue;
    const mobile = doc.defaultView?.matchMedia?.('(max-width: 520px)').matches;
    const applied = mobile ? { ...override, ...(override.mobile || {}) } : override;
    if (
      !CONTENT_MANAGED_TEXT_IDS.has(id) &&
      typeof override.text === 'string' &&
      element.dataset.publishedText !== override.text &&
      element.textContent !== override.text
    ) element.textContent = override.text;
    element.style.fontWeight = applied.bold ? '700' : '';
    element.style.fontStyle = applied.italic ? 'italic' : '';
    element.style.textAlign = applied.align || '';
    const sizeScale = scaleFor(override, Boolean(mobile));
    element.style.fontSize = sizeScale === 100 ? '' : `${getBaseFontSize(element, Boolean(mobile)) * sizeScale / 100}px`;
    const x = Number(applied.x || 0);
    const y = Number(applied.y || 0);
    element.style.translate = x || y ? `${x}px ${y}px` : '';
  }

}

export function PublishedVisualDesign({ overrides }: { overrides: Record<string, VisualOverride> }) {
  useEffect(() => {
    const apply = () => applyToDocument(document, overrides);
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['id'] });
    const media = window.matchMedia('(max-width: 520px)');
    media.addEventListener('change', apply);
    /*
      A prévia administrativa muda a largura do iframe depois que o documento
      já hidratou. O ResizeObserver garante que a variante móvel seja
      reaplicada mesmo quando o navegador não entrega o evento de media query
      a tempo.
    */
    const resizeObserver = new ResizeObserver(apply);
    resizeObserver.observe(document.documentElement);
    requestAnimationFrame(apply);
    const firstLayoutRetry = window.setTimeout(apply, 80);
    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      media.removeEventListener('change', apply);
      window.clearTimeout(firstLayoutRetry);
    };
  }, [overrides]);

  return <style data-published-visual-initial dangerouslySetInnerHTML={{ __html: initialVisualCss(overrides) }} />;
}
