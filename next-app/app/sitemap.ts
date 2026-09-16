import type {MetadataRoute} from 'next';
import {getPublicGalleryData} from '@/lib/public-gallery';

const SITE_URL='https://photosrangel.pt';

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  // Páginas estáticas: não inventamos lastModified a cada deploy. O Google
  // deve receber uma data apenas quando temos uma data real de alteração.
  const base:MetadataRoute.Sitemap=[
    {url:`${SITE_URL}/`,changeFrequency:'weekly',priority:1},
    {url:`${SITE_URL}/galeria`,changeFrequency:'weekly',priority:.9},
    {url:`${SITE_URL}/sobre`,changeFrequency:'monthly',priority:.7},
    {url:`${SITE_URL}/contato`,changeFrequency:'monthly',priority:.7},
    {url:`${SITE_URL}/privacidade`,changeFrequency:'yearly',priority:.2},
    {url:`${SITE_URL}/termos`,changeFrequency:'yearly',priority:.2},
  ];

  try{
    const {galleries}=await getPublicGalleryData();
    return [
      ...base,
      ...galleries.map(g=>({
        url:`${SITE_URL}/galeria/${g.slug}`,
        ...(g.created_at?{lastModified:new Date(g.created_at)}:{}),
        changeFrequency:'monthly' as const,
        priority:.8,
      })),
    ];
  }catch{
    // Mantém o sitemap das páginas principais disponível mesmo se o CMS
    // estiver temporariamente indisponível.
    return base;
  }
}
