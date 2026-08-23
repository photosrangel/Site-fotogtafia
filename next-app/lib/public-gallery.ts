import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

export type PublicPhoto={id:string;gallery_id:string;image_url:string;alt_text?:string;sort_order:number};
export type PublicTrail={id:string;name:string;slug:string;description?:string;cover_url?:string;cover_focus_x?:number;cover_focus_y?:number;sort_order:number};
export type PublicCategory={id:string;name:string;slug:string;sort_order:number;trail_id?:string};
export type PublicGallery={id:string;title:string;slug:string;category_id?:string;cover_url?:string;cover_focus_x?:number;cover_focus_y?:number;sort_order:number;categorySlug:string;categoryName:string;trailId?:string;photos:PublicPhoto[]};

const emptyGalleryData={trails:[] as PublicTrail[],categories:[] as PublicCategory[],galleries:[] as PublicGallery[]};
const normalizeName=(value?:string)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

async function fetchPublicGalleryData():Promise<{trails:PublicTrail[];categories:PublicCategory[];galleries:PublicGallery[]}>{
    const client=createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
    );
    const initial=await Promise.all([
      client.from('galleries').select('id,title,slug,category_id,trail_id,cover_url,cover_focus_x,cover_focus_y,sort_order,created_at').eq('published',true).order('sort_order').order('created_at',{ascending:false}),
      client.from('categories').select('id,name,slug,sort_order,trail_id').order('sort_order').order('name'),
      client.from('gallery_photos').select('id,gallery_id,image_url,alt_text,sort_order').eq('published',true).order('sort_order'),
      client.from('gallery_trails').select('id,name,slug,description,cover_url,cover_focus_x,cover_focus_y,sort_order').eq('published',true).order('sort_order')
    ]);
    let g:any=initial[0];
    const c=initial[1];
    const p=initial[2];
    let t:any=initial[3];

    // Mantém o conteúdo visível mesmo durante uma atualização incompleta do banco.
    if(g.error?.message?.includes('cover_focus_')){
      g=await client.from('galleries').select('id,title,slug,category_id,trail_id,cover_url,sort_order,created_at').eq('published',true).order('sort_order').order('created_at',{ascending:false});
    }
    if(t.error?.message?.includes('cover_focus_')){
      t=await client.from('gallery_trails').select('id,name,slug,description,cover_url,sort_order').eq('published',true).order('sort_order');
    }
    if(g.error||c.error||p.error||t.error)throw g.error||c.error||p.error||t.error;

    const trails=(t.data||[]) as PublicTrail[];
    const portraitTrail=trails.find(item=>{const identity=normalizeName(`${item.slug} ${item.name}`);return identity.includes('retrato')&&identity.includes('corporativo')})?.id;
    const selfEsteemTrail=trails.find(item=>{const identity=normalizeName(`${item.slug} ${item.name}`);return identity.includes('autoestima')&&(identity.includes('sensual')||identity.includes('boudoir'))})?.id;
    const categories=((c.data||[]) as PublicCategory[]).map(category=>{
      const categoryIdentity=normalizeName(`${category.slug} ${category.name}`);
      if(portraitTrail&&['estudio','externo','corporativo','retratos','retrato'].some(value=>categoryIdentity.includes(value)))return {...category,trail_id:portraitTrail};
      if(selfEsteemTrail&&['autoestima','sensual','boudoir'].some(value=>categoryIdentity.includes(value)))return {...category,trail_id:selfEsteemTrail};
      return category;
    });
    if(portraitTrail&&!categories.some(category=>category.slug==='corporativo')){
      categories.push({id:'virtual-corporativo',name:'Corporativo',slug:'corporativo',sort_order:30,trail_id:portraitTrail});
    }
    const map=new Map(categories.map(item=>[item.id,item]));
    const photos=(p.data||[]) as PublicPhoto[];
    return {
      trails,
      categories,
      galleries:(g.data||[]).map((item:any)=>{
        const category=map.get(item.category_id);
        const inferredCorporate=!category&&/corporativ/i.test(`${item.slug||''} ${item.title||''}`);
        return {...item,categorySlug:category?.slug||(inferredCorporate?'corporativo':'sem-categoria'),categoryName:category?.name||(inferredCorporate?'Corporativo':'Sem categoria'),trailId:category?.trail_id||(inferredCorporate?portraitTrail:item.trail_id)||undefined,photos:photos.filter(photo=>photo.gallery_id===item.id)};
      }).filter((item:any)=>item.photos.length>0) as PublicGallery[]
    };
}

const getCachedPublicGalleryData=unstable_cache(
  fetchPublicGalleryData,
  ['public-gallery-data-v69'],
  {revalidate:30,tags:['public-gallery']}
);

export async function getPublicGalleryData():Promise<{trails:PublicTrail[];categories:PublicCategory[];galleries:PublicGallery[]}>{
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)return emptyGalleryData;
  try{return await getCachedPublicGalleryData()}catch{return emptyGalleryData}
}

export async function getRecentPhotos(limit=6){
  const {galleries}=await getPublicGalleryData();
  return galleries.flatMap(gallery=>gallery.photos).sort((a,b)=>a.sort_order-b.sort_order).slice(0,limit);
}
