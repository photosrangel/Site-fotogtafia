import type { Metadata } from 'next';
import './globals.css';
import { HydrationMarker } from '@/components/hydration-marker';
import { PublishedVisualDesign } from '@/components/published-visual-design';
import { FloatingWhatsApp } from '@/components/floating-whatsapp';
import { getPublishedDesignConfig } from '@/lib/published-design';

export const metadata: Metadata = {
  title: { default: 'Rangel Santos — Fotografia', template: '%s — Rangel Santos' },
  description: 'Fotografia autoral, retratos e experiências personalizadas.'
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const publishedDesign = await getPublishedDesignConfig();
  const visualOverrides = publishedDesign.inline_styles || {};
  return (
    <html lang="pt" data-scroll-behavior="smooth">
      <head>
        <link rel="stylesheet" href="/legacy/css/style.css" />
      </head>
      <body><HydrationMarker /><PublishedVisualDesign overrides={visualOverrides}/>{children}<FloatingWhatsApp config={publishedDesign}/></body>
    </html>
  );
}
