'use client';

import { useEffect } from 'react';

export function HydrationMarker() {
  useEffect(() => {
    const identifyEditableElements = () => {
      const mark = (element: Element | null,id: string) => {
        if (!(element instanceof HTMLElement)) return;
        if (!element.id) element.id=id;
        element.dataset.designEditable='1';
      };
      const mappings: Array<[string,string]> = [
        ['.hero-eyebrow','hero-eyebrow'],['.hero-title','hero-title'],['.hero-sub','hero-description'],
        ['.hero .btn:not(.btn-accent)','hero-primary-button'],['.hero .btn.btn-accent','hero-secondary-button'],
        ['.about-text .section-eyebrow','sobre-eyebrow-preview'],['.about-text .btn.btn-accent','sobre-cta-preview'],
        ['.contact-grid button[type="submit"]','contato-submit-preview'],
        ['.contact-info dt:last-of-type + dd','contato-atendimento-preview']
      ];
      const path = window.location.pathname;
      if (path === '/contato') {
        mappings.push(['.section-head .section-eyebrow','contato-eyebrow-preview'],['.section-head .section-title','contato-title-preview']);
      }
      mappings.forEach(([selector,id]) => mark(document.querySelector(selector),id));
      document.querySelectorAll('.about-text > div > p').forEach((el,index)=>mark(el,`sobre-paragraph-${index}`));
      document.querySelectorAll('.specs dt').forEach((el,index)=>mark(el,`sobre-spec-label-${index}`));
      document.querySelectorAll('.specs dd').forEach((el,index)=>mark(el,`sobre-spec-value-${index}`));
      document.querySelectorAll<HTMLElement>('.filters .filter-btn').forEach(el => {
        if (el.id.startsWith('gallery-filter-')) el.removeAttribute('id');
        delete el.dataset.designEditable;
        delete el.dataset.designInlineEditable;
        delete el.dataset.designInlineKey;
        el.removeAttribute('title');
      });
      document.querySelectorAll('.frame-title-bar').forEach((el,index)=>mark(el,`gallery-card-title-${index}`));
      document.querySelectorAll('.contact-info dt').forEach((el,index)=>mark(el,`contato-info-label-${index}`));
      document.querySelectorAll('.contact-info dd').forEach((el,index)=>mark(el,`contato-info-value-${index}`));
      document.querySelectorAll('.field > label').forEach((el,index)=>mark(el,`contato-field-label-${index}`));
      document.querySelectorAll('.hero-meta strong').forEach((el,index)=>mark(el,`hero-meta-label-${index}`));
      document.querySelectorAll('.hero-meta > div > span').forEach((el,index)=>mark(el,`hero-meta-value-${index}`));
      document.querySelectorAll('.nav-links > a').forEach((el,index)=>mark(el,`nav-link-${index}`));
      mark(document.querySelector('.nav-logo'),'nav-logo-preview');
      document.querySelectorAll('.footer-links > a').forEach((el,index)=>mark(el,`footer-link-${index}`));
      mark(document.querySelector('.footer-mono'),'footer-text-preview');
      mark(document.querySelector('#gallery-eyebrow'),'gallery-eyebrow');
      mark(document.querySelector('#gallery-title'),'gallery-title');
    };

    document.documentElement.dataset.reactHydrated = '1';
    window.dispatchEvent(new Event('rangel:hydrated'));
    identifyEditableElements();
    const observer = new MutationObserver(identifyEditableElements);
    observer.observe(document.body,{childList:true,subtree:true});

    return () => {
      observer.disconnect();
      delete document.documentElement.dataset.reactHydrated;
    };
  }, []);

  return null;
}
