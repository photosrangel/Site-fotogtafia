import type { Metadata } from 'next';
import './globals.css';
import './public-site.css';
import { HydrationMarker } from '@/components/hydration-marker';
import { PublishedVisualDesign } from '@/components/published-visual-design';
import { FloatingWhatsApp } from '@/components/floating-whatsapp';
import { getPublishedDesignConfig } from '@/lib/published-design';
import { DesignPreviewReceiver } from '@/components/design-preview-receiver';

export const metadata: Metadata = {
  title: { default: 'Rangel Santos — Fotografia', template: '%s — Rangel Santos' },
  description: 'Fotografia autoral, retratos e experiências personalizadas.'
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
  return (
    <html lang="pt" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning><HydrationMarker /><DesignPreviewReceiver/><PublishedVisualDesign config={publishedDesign}/>{children}<FloatingWhatsApp config={publishedDesign}/></body>
    </html>
  );
}
