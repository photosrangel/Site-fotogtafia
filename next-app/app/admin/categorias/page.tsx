import type { Metadata } from 'next';
import { AdminCategoriesNative } from '@/components/admin-categories-native';
import '../admin.css';

export const metadata:Metadata={title:'Categorias — Admin',robots:{index:false,follow:false}};
export default function AdminCategoriesPage(){return <AdminCategoriesNative/>}
