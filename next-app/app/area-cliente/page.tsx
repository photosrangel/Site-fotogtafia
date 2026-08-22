import type { Metadata } from 'next';
import { LegacyPage } from '@/components/legacy-page';
export const metadata: Metadata={title:'Área do Cliente',robots:{index:false,follow:false}};
export default function ClientAreaPage(){return <LegacyPage file="area-cliente.html" title="Área do Cliente"/>}
