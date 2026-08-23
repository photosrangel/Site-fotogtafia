import type { Metadata } from 'next';
import { PublicNav } from '@/components/public-nav';
import { PublicFooter } from '@/components/public-footer';
import { ContactForm } from '@/components/contact-form';
import { getNativePageData } from '@/lib/site-content';
export const metadata:Metadata={title:'Contato'};
/* Rede de segurança: ver comentário equivalente em app/page.tsx. */
export const revalidate = 30;
const defaults={eyebrow:'Renove sua autoestima',title:'Contato',submit_label:'Enviar mensagem',tipos:['Sessão de Autoestima','Retrato em Estúdio','Retrato Externo','Sessão Sensual','Outro'],atendimento:'Vale de Cambra e arredores — sessões sob agendamento'};
export default async function ContactPage(){const {settings,content}=await getNativePageData('contato');const c=content.conteudo||{};const types=Array.isArray(c.tipos)&&c.tipos.length?c.tipos:defaults.tipos;const email=settings.email||'rangelsantos1812@gmail.com';return <div className="native-page"><PublicNav active="/contato" siteName={settings.site_name}/><section className="section inner-page-section"><div className="container"><div className="section-head"><div><p className="section-eyebrow">{c.eyebrow||defaults.eyebrow}</p><h2 className="section-title">{c.title||defaults.title}</h2></div></div><div className="contact-grid"><ContactForm types={types} submitLabel={c.submit_label||defaults.submit_label}/><dl className="contact-info"><dt>E-mail</dt><dd><a href={`mailto:${email}`} target="_blank" rel="noopener">{email}</a></dd><dt>WhatsApp</dt><dd><a href="https://wa.me/351931159748" target="_blank" rel="noopener">+351 931 159 748</a></dd><dt>Instagram</dt><dd><a href="https://instagram.com/photosrangel" target="_blank" rel="noopener">@photosrangel</a></dd><dt>Atendimento</dt><dd>{c.atendimento||defaults.atendimento}</dd></dl></div></div></section><PublicFooter footerText={settings.footer_text} instagram="https://instagram.com/photosrangel" whatsapp="351931159748"/></div>}
