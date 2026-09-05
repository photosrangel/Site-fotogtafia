import type { Metadata } from 'next';
import './globals.css';
import { HydrationMarker } from '@/components/hydration-marker';
import { PublishedVisualDesign } from '@/components/published-visual-design';
import { FloatingWhatsApp } from '@/components/floating-whatsapp';
import { getPublishedDesignConfig } from '@/lib/published-design';
import { PrivacyAnalytics } from '@/components/privacy-analytics';

export const metadata: Metadata = {
  metadataBase: new URL('https://photosrangel.pt'),
  title: { default: 'Rangel Santos — Fotografia', template: '%s — Rangel Santos' },
  description: 'Fotografia de retrato feminino em Vale de Cambra, Aveiro.',
  alternates:{canonical:'/'},
  openGraph:{type:'website',locale:'pt_PT',siteName:'Rangel Santos Fotografia',images:['/images/hero-bg.jpg']},
  twitter:{card:'summary_large_image'}
};

/*
 * Rede de segurança (ver o mesmo comentário em app/page.tsx): o layout
 * raiz é quem busca os overrides visuais (design.published.inline_styles)
 * usados pelos textos editados diretamente na prévia — rodapé, Área do
 * Cliente, etc. Sem isto, esses textos também dependiam 100% da
 * revalidação sob demanda funcionar.
 */
export const revalidate = 30;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const publishedDesign = await getPublishedDesignConfig();
  const visualOverrides = publishedDesign.inline_styles || {};
  return (
    <html lang="pt" data-scroll-behavior="smooth">
      <head>
        <link rel="stylesheet" href="/legacy/css/style.css?v=67-gallery-mobile-2" />
      </head>
      <body><HydrationMarker /><PublishedVisualDesign overrides={visualOverrides}/>{children}<FloatingWhatsApp config={publishedDesign}/><PrivacyAnalytics /></body>
    </html>
  );
}
