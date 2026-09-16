import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {PublicNav} from '@/components/public-nav';
import {PublicFooter} from '@/components/public-footer';
import {GalleryViewer} from '@/components/gallery-viewer';
import {createSupabasePublicClient} from '@/lib/supabase/public';

type Props={params:Promise<{slug:string}>};

async function load(slug:string){
  const db=createSupabasePublicClient();
  const {data}=await db.from('galleries').select('id,title,slug,description,cover_url,cover_focus_x,cover_focus_y,session_type,session_location,session_date_text,credits,cta_text,cta_url,seo_title,seo_description,social_image_url,canonical_slug,published').eq('slug',slug).eq('published',true).maybeSingle();
  if(!data)return null;
  const {data:photos}=await db.from('gallery_photos').select('id,image_url,alt_text,sort_order').eq('gallery_id',data.id).eq('published',true).order('sort_order');
  return{...data,photos:photos||[]};
}

export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {slug}=await params,g=await load(slug);
  if(!g)return{};
  const canonical=`/galeria/${g.canonical_slug||g.slug}`;
  const sessionType=g.session_type||'Ensaio fotográfico feminino';
  const location=g.session_location||'Vale de Cambra, Aveiro';
  // Campos SEO preenchidos no Admin continuam tendo prioridade. Quando não
  // existem, cada galeria recebe metadados descritivos próprios automaticamente.
  const title=g.seo_title||`${sessionType} — ${g.title}`;
  const description=g.seo_description||g.description||`${sessionType} de ${g.title}, fotografado por Rangel Santos em ${location}. Conheça esta sessão e o portfólio.`;
  const image=g.social_image_url||g.cover_url||g.photos[0]?.image_url;
  return{
    title,
    description,
    alternates:{canonical},
    openGraph:{title,description,url:canonical,type:'article',locale:'pt_PT',images:image?[{url:image,alt:`${sessionType} — ${g.title}`}]:[]},
    twitter:{card:'summary_large_image',title,description,images:image?[image]:[]},
  };
}

export default async function Page({params}:Props){
  const {slug}=await params,g=await load(slug);
  if(!g)notFound();
  const details=[['Tipo de sessão',g.session_type],['Local',g.session_location],['Data',g.session_date_text],['Créditos',g.credits]].filter((item):item is [string,string]=>Boolean(item[1]));
  const hero=g.cover_url||g.photos[0]?.image_url;
  return <div className="native-page gallery-story-page"><PublicNav active="/galeria"/><main><header className={`gallery-story-hero${hero?' has-image':''}`} style={hero?{backgroundImage:`linear-gradient(180deg,rgba(5,5,5,.08),rgba(5,5,5,.78)),url('${hero}')`,backgroundPosition:`${g.cover_focus_x??50}% ${g.cover_focus_y??50}%`}:undefined}><div className="gallery-story-hero-copy"><p>{g.session_type||'Ensaio fotográfico'}</p><h1>{g.title}</h1><span>{g.photos.length} {g.photos.length===1?'fotografia':'fotografias'}</span></div></header><div className="gallery-story-shell">{g.description&&<section className="gallery-story-intro"><p className="section-eyebrow">Sobre o ensaio</p><p>{g.description}</p></section>}<GalleryViewer photos={g.photos} galleryTitle={g.title}/>{(details.length>0||g.cta_text)&&<section className="gallery-story-details"><div className="gallery-story-details-copy"><p className="section-eyebrow">Ficha do ensaio</p><h2>Uma história contada em imagens.</h2></div>{details.length>0&&<dl>{details.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}{g.cta_text&&<Link className="btn gallery-story-cta" href={g.cta_url||'/contato'}>{g.cta_text}</Link>}</section>}</div></main><PublicFooter/></div>;
}
