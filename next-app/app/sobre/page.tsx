import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicNav } from '@/components/public-nav';
import { PublicFooter } from '@/components/public-footer';
import { getNativePageData,legacyMediaUrl } from '@/lib/site-content';

export const metadata:Metadata={title:'Sobre o fotógrafo',description:'Conheça Rangel Santos, fotógrafo de retratos femininos em Vale de Cambra.',alternates:{canonical:'/sobre'},openGraph:{url:'/sobre',images:['/legacy/images/sobre-retrato.jpg']}};
export const revalidate = 30;
const defaults={eyebrow:'Sobre mim',paragraphs:['Meu nome é Rangel Santos, fotógrafo em Vale de Cambra, Portugal. Meu trabalho é dedicado ao retrato feminino — não o retrato que só mostra como você é por fora, mas aquele que devolve algo por dentro.','Ajudar mulheres a reconstruir a autoestima é o que me motiva a cada sessão. Muitas chegam inseguras diante da câmera, e minha função é criar o ambiente certo para que isso se dissolva — com luz, tempo, e escuta.','Cada projeto é entregue com cuidado: você recebe um link privado para escolher suas fotos favoritas, e eu trato as imagens escolhidas uma a uma antes da entrega final.'],specs:[{label:'Baseado em',value:'Vale de Cambra, Portugal'},{label:'Especialidade',value:'Retrato Feminino & Autoestima'},{label:'Prazo de entrega',value:'05–10 dias úteis'},{label:'Atende',value:'Vale de Cambra e arredores'}]};

export default async function AboutPage(){
  const {settings,content}=await getNativePageData('sobre');
  const c=content.conteudo||{};
  const paragraphs=Array.isArray(c.paragraphs)&&c.paragraphs.length?c.paragraphs:defaults.paragraphs;
  const saved=Array.isArray(c.specs)?c.specs.filter((item:any)=>item?.label&&item?.value):[];
  const key=(value:string)=>String(value||'').toLocaleLowerCase('pt-PT').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const savedMap=new Map(saved.map((item:any)=>[key(item.label),item]));
  const specs=defaults.specs.map(item=>{const match=savedMap.get(key(item.label)) as {label:string;value:string}|undefined;if(match){savedMap.delete(key(item.label));return match}if(item.label==='Baseado em'&&settings.location)return {...item,value:settings.location};if(item.label==='Especialidade'&&settings.specialty)return {...item,value:settings.specialty};return item});
  savedMap.forEach((item:any)=>specs.push(item));
  const portrait=legacyMediaUrl(c.portrait_url,'images/retrato-01.jpg');
  const focusX=Math.min(100,Math.max(0,Number(c.portrait_focus_x??50)));
  const focusY=Math.min(100,Math.max(0,Number(c.portrait_focus_y??72)));
  return <div className="native-page premium-about-page"><PublicNav active="/sobre" siteName={settings.site_name}/><main>
    <section className="premium-about-hero"><div className="premium-about-image"><img src={portrait} alt={c.portrait_alt||'Retrato de Rangel Santos, fotógrafo'} style={{objectPosition:`${focusX}% ${focusY}%`}}/></div><div className="premium-about-intro"><p className="section-eyebrow">{c.eyebrow||defaults.eyebrow}</p><h1>Por trás<br/>de cada <em>retrato.</em></h1><div className="premium-about-lead">{paragraphs.map((text:string,index:number)=><p key={index}>{text}</p>)}</div></div></section>
    <section className="premium-about-lower"><div className="premium-about-story"><div className="premium-about-statement"><span>Um olhar atento.</span><h2>Fotografar é criar espaço para você se reconhecer.</h2></div><div className="premium-about-copy">{paragraphs.slice(1).map((text:string,index:number)=><p key={index}>{text}</p>)}</div></div><div className="premium-about-details"><p className="section-eyebrow">A experiência</p><dl className="specs">{specs.map((spec:{label:string;value:string},index:number)=><div key={index}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl><Link href={c.cta_url||'/contato'} className="btn btn-accent">{c.cta_text||'Vamos conversar'}</Link></div></section>
  </main><PublicFooter footerText={settings.footer_text} instagram={settings.instagram_url} whatsapp={settings.whatsapp}/></div>
}
