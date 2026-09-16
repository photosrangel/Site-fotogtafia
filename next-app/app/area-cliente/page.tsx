import type { Metadata } from 'next';
import { NativeClientArea } from '@/components/native-client-area';
export const metadata: Metadata={title:'Área do Cliente',robots:{index:false,follow:false}};
export default function ClientAreaPage(){return <NativeClientArea/>}
