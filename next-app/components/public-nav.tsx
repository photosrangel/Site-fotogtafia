'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function PublicNav({ active, siteName = 'Rangel Santos' }: { active: string; siteName?: string | null }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const current = window.scrollY;
      setHidden(current > 4 && current >= last);
      last = current;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const links = [['/', 'Início'], ['/galeria', 'Galeria'], ['/sobre', 'Sobre'], ['/contato', 'Contato']];
  const brand = String(siteName || 'Rangel Santos').replace(/\s*(?:—|-)\s*Fotografia\s*$/i, '').trim();
  const [first, ...rest] = brand.split(/\s+/);

  return <nav className={`nav${hidden && !open ? ' nav-hidden' : ''}`}>
    <div className="container">
      <Link href="/" className="nav-logo">{first || 'Rangel'} <em>{rest.join(' ') || 'Santos'}</em> <span className="nav-logo-photo">Fotografia</span></Link>
      <button className="nav-toggle" type="button" aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open} onClick={() => setOpen(value => !value)}><span/><span/><span/></button>
      <div className={`nav-links${open ? ' is-open' : ''}`}>
        <button className="nav-menu-close" type="button" aria-label="Fechar menu" onClick={() => setOpen(false)}><span aria-hidden="true">×</span><b>Fechar</b></button>
        {links.map(([href, label]) => <Link key={href} href={href} prefetch={false} className={active === href ? 'active' : undefined} onClick={() => setOpen(false)}>{label}</Link>)}
        <Link href="/area-cliente" className="nav-cta" onClick={() => setOpen(false)}>Área do Cliente</Link>
      </div>
    </div>
  </nav>;
}
