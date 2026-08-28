import type { Metadata } from 'next';
import { PublicNav } from '@/components/public-nav';
import { PublicFooter } from '@/components/public-footer';
import { ClientAreaExperience } from '@/components/client-area-experience';
import { getNativePageData } from '@/lib/site-content';
import './client-area.css';
export const metadata: Metadata={title:'Área do Cliente',robots:{index:false,follow:false}};
export const revalidate=30;
export default async function ClientAreaPage(){const {settings}=await getNativePageData('area-cliente');return <div className="native-page client-area-premium"><PublicNav active="/area-cliente" siteName={settings.site_name}/><ClientAreaExperience/><PublicFooter footerText={settings.footer_text} instagram={settings.instagram_url} whatsapp={settings.whatsapp}/></div>}
