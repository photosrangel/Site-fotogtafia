'use client';

import { usePathname } from 'next/navigation';
import type { PublishedDesignConfig } from '@/lib/published-design';

const pageName = (pathname: string) => {
  if (pathname === '/' || pathname === '/inicio') return 'inicio';
  if (pathname.startsWith('/galeria')) return 'galeria';
  if (pathname.startsWith('/sobre')) return 'sobre';
  if (pathname.startsWith('/contato')) return 'contato';
  return '';
};

export function FloatingWhatsApp({ config }: { config: PublishedDesignConfig }) {
  const pathname = usePathname();
  const page = pageName(pathname);
  const digits = String(config.whatsapp_number || '').replace(/\D/g, '');
  const pages = Array.isArray(config.whatsapp_pages) ? config.whatsapp_pages : ['inicio', 'galeria', 'sobre', 'contato'];

  if (config.whatsapp_enabled === false || !digits || !page || !pages.includes(page)) return null;

  const message = String(config.whatsapp_message || '').trim();
  const style = ['editorial', 'minimal', 'classic'].includes(String(config.whatsapp_style)) ? config.whatsapp_style : 'editorial';
  const href = `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;

  return <a id="rs-whatsapp-float" className={`rs-whatsapp-float is-${style}${config.whatsapp_position === 'left' ? ' is-left' : ''}`} href={href} target="_blank" rel="noopener" aria-label="Fale comigo pelo WhatsApp">
    <span className="rs-wa-icon" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><path fill="currentColor" d="M16.04 3.2A12.73 12.73 0 0 0 5.1 22.43L3.4 28.8l6.52-1.7A12.8 12.8 0 1 0 16.04 3.2Zm0 23.32c-2.04 0-4.03-.55-5.77-1.58l-.41-.24-3.87 1.01 1.03-3.76-.27-.43a10.5 10.5 0 1 1 9.29 5Zm5.76-7.87c-.32-.16-1.87-.92-2.16-1.03-.29-.11-.5-.16-.71.16-.21.32-.82 1.03-1 1.24-.18.21-.37.24-.69.08-.32-.16-1.33-.49-2.54-1.57a9.5 9.5 0 0 1-1.76-2.19c-.18-.32-.02-.49.14-.65.14-.14.32-.37.47-.55.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.55-.08-.16-.71-1.71-.97-2.35-.26-.61-.52-.53-.71-.54h-.61c-.21 0-.55.08-.84.4-.29.32-1.1 1.08-1.1 2.63s1.13 3.05 1.29 3.26c.16.21 2.22 3.39 5.38 4.75.75.32 1.34.52 1.8.67.76.24 1.44.21 1.99.13.61-.09 1.87-.77 2.13-1.5.26-.74.26-1.37.18-1.5-.08-.14-.29-.21-.61-.37Z"/></svg></span>
    <b>Fale comigo</b>
  </a>;
}
