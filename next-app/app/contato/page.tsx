import type { Metadata } from 'next';
import { PublicNav } from '@/components/public-nav';
import { PublicFooter } from '@/components/public-footer';
import { ContactForm } from '@/components/contact-form';
import { getNativePageData } from '@/lib/site-content';

export const metadata:Metadata={title:'Contato e agendamento',description:'Agende a sua sessão fotográfica em Vale de Cambra e arredores.',alternates:{canonical:'/contato'},openGraph:{url:'/contato'}};
export const revalidate = 30;
const defaults={eyebrow:'Renove sua autoestima',title:'Contato',submit_label:'Enviar mensagem',tipos:['Sessão de Autoestima','Retrato em Estúdio','Retrato Externo','Sessão Sensual','Outro'],atendimento:'Vale de Cambra e arredores — sessões sob agendamento'};

export default async function ContactPage(){
  const {settings,content}=await getNativePageData('contato');const c=content.conteudo||{};const types=Array.isArray(c.tipos)&&c.tipos.length?c.tipos:defaults.tipos;const email=settings.email||'rangelsantos1812@gmail.com';
  return <div className="native-page premium-contact-page"><PublicNav active="/contato" siteName={settings.site_name}/><main>
    <header className="premium-contact-hero"><div><p className="section-eyebrow">{c.eyebrow||defaults.eyebrow}</p><h1>Vamos criar<br/>algo <em>seu.</em></h1></div><div className="premium-contact-intro"><p>Conte um pouco sobre você e sobre o ensaio que imagina. Cada experiência começa com uma conversa.</p></div></header>
    <section className="premium-contact-shell"><div className="premium-contact-form"><div className="premium-contact-form-head"><p className="section-eyebrow">{c.title||defaults.title}</p><span>Preencha os dados abaixo</span></div><ContactForm types={types} submitLabel={c.submit_label||defaults.submit_label}/></div><aside className="premium-contact-aside"><h2>Estou por aqui.</h2><dl className="contact-info"><div><dt>E-mail</dt><dd><a href={`mailto:${email}`} target="_blank" rel="noopener">{email}</a></dd></div><div><dt>WhatsApp</dt><dd><a href="https://wa.me/351931159748" target="_blank" rel="noopener">+351 931 159 748</a></dd></div><div><dt>Instagram</dt><dd><a href="https://instagram.com/photosrangel" target="_blank" rel="noopener">@photosrangel</a></dd></div><div><dt>Atendimento</dt><dd>{c.atendimento||defaults.atendimento}</dd></div></dl></aside></section>
  </main><PublicFooter footerText={settings.footer_text} instagram="https://instagram.com/photosrangel" whatsapp="351931159748"/></div>
}
