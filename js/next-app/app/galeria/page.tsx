import type { Metadata } from 'next';
import { PublicNav } from '@/components/public-nav';
import { PublicFooter } from '@/components/public-footer';
import { GalleryExperience } from '@/components/gallery-experience';
import { getNativePageData } from '@/lib/site-content';
import { getPublicGalleryData } from '@/lib/public-gallery';
export const metadata:Metadata={title:'Galeria de retratos',description:'Retratos femininos e ensaios fotográficos realizados em Vale de Cambra e arredores.',alternates:{canonical:'/galeria'},openGraph:{title:'Galeria de retratos — Rangel Santos Fotografia',description:'Conheça sessões em estúdio, externas e corporativas.',url:'/galeria'}};
export const revalidate=30;
export default async function GalleryPage(){const [{settings},{trails,categories,galleries}]=await Promise.all([getNativePageData('galeria'),getPublicGalleryData()]);return <div className="native-page"><PublicNav active="/galeria" siteName={settings.site_name}/><section className="section inner-page-section"><div className="container"><div className="section-head"><div><p id="gallery-eyebrow" className="section-eyebrow">Nossa</p><h2 id="gallery-title" className="section-title">Galeria</h2></div></div><GalleryExperience trails={trails} categories={categories} galleries={galleries}/></div></section><PublicFooter footerText={settings.footer_text} instagram={settings.instagram_url} whatsapp={settings.whatsapp}/></div>}
