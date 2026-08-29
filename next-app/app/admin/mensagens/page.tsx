import type { Metadata } from 'next';import { AdminMessages } from '@/components/admin-messages';import '../admin.css';
export const metadata:Metadata={title:'Mensagens — Admin',robots:{index:false,follow:false}};export default function Page(){return <AdminMessages/>}
