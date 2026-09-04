import type { Metadata } from 'next';
import { LegacyPage } from '@/components/legacy-page';
export const metadata: Metadata={title:'Admin',robots:{index:false,follow:false}};
export default function AdminPage(){return <LegacyPage file="admin-v2.html" title="Admin"/>}
