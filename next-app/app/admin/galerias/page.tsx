import type { Metadata } from 'next';
import { AdminGalleries } from '@/components/admin-galleries';
import '../admin.css';
export const metadata:Metadata={title:'Galerias — Admin',robots:{index:false,follow:false}};
export default function AdminGalleriesPage(){return <AdminGalleries/>}
