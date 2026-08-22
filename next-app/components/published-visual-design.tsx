'use client';

import { useEffect } from 'react';
import type { VisualOverride } from '@/lib/published-design';

type VisualElement = HTMLElement & { __publishedBaseFontSizes?: Record<string, number> };

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

function applyToDocument(doc: Document, overrides: Record<string, VisualOverride>) {
  if (doc.documentElement?.dataset.designPreviewActive === '1') return;
  for (const [id, override] of Object.entries(overrides)) {
    const element = doc.getElementById(id) as VisualElement | null;
    if (!element) continue;
    const mobile = doc.defaultView?.matchMedia?.('(max-width: 520px)').matches;
    const applied = mobile ? { ...override, ...(override.mobile || {}) } : override;
    if (typeof override.text === 'string' && element.textContent !== override.text) element.textContent = override.text;
    element.style.fontWeight = applied.bold ? '700' : '';
    element.style.fontStyle = applied.italic ? 'italic' : '';
    element.style.textAlign = applied.align || '';
    const legacyScale = applied.size === 'small' ? 86 : applied.size === 'large' ? 114 : 100;
    const rawScale = Number(applied.size_scale ?? legacyScale);
    const maximumScale = mobile && id === 'hero-title' ? 160 : 250;
    const sizeScale = Number.isFinite(rawScale) ? Math.max(50, Math.min(maximumScale, rawScale)) : 100;
    element.style.fontSize = sizeScale === 100 ? '' : `${getBaseFontSize(element, Boolean(mobile)) * sizeScale / 100}px`;
    const x = Number(applied.x || 0);
    const y = Number(applied.y || 0);
    element.style.translate = x || y ? `${x}px ${y}px` : '';
  }

  doc.querySelectorAll<HTMLIFrameElement>('iframe.legacy-frame').forEach(frame => {
    const applyFrame = () => {
      try { if (frame.contentDocument) applyToDocument(frame.contentDocument, overrides); } catch {}
    };
    if (frame.dataset.visualDesignBound !== '1') {
      frame.dataset.visualDesignBound = '1';
      frame.addEventListener('load', applyFrame);
    }
    applyFrame();
  });
}

export function PublishedVisualDesign({ overrides }: { overrides: Record<string, VisualOverride> }) {
  useEffect(() => {
    const apply = () => applyToDocument(document, overrides);
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['id'] });
    const media = window.matchMedia('(max-width: 520px)');
    media.addEventListener('change', apply);
    return () => { observer.disconnect(); media.removeEventListener('change', apply); };
  }, [overrides]);

  return null;
}
