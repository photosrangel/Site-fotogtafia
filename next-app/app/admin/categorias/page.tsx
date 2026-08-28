import type { Metadata } from 'next';
import { AdminCategories } from '@/components/admin-categories';
import '../admin.css';

export const metadata:Metadata={title:'Categorias — Admin',robots:{index:false,follow:false}};
export default function AdminCategoriesPage(){return <AdminCategories/>}
