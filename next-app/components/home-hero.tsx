'use client';
import Link from 'next/link';
import { Fragment,useEffect,useMemo,useState } from 'react';
import { publicMediaUrl } from '@/lib/public-media';
type Slide={url:string;alt?:string;published?:boolean;sort_order?:number;focus_x?:number;focus_y?:number};
/*
 * Antes, o título usava title.split(/\s+/), que trata quebras de linha
 * (\n) exatamente como espaços — ou seja, qualquer quebra manual feita
 * no editor visual do painel era descartada aqui, mesmo com o cuidado
 * que o admin tem para preservá-la. Esta versão respeita cada linha
 * digitada e, dentro da última linha com conteúdo, mantém a mesma regra
 * visual de sempre (a última palavra em itálico) — igual ao que o
 * painel mostra na prévia (ver renderHeroTitleForEditing no admin-v2.js).
 */
function renderHeroTitle(title:string){
  const lines=title.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  let lastContentLine=lines.length-1;
  for(let i=lines.length-1;i>=0;i--){if(lines[i].trim()){lastContentLine=i;break}}
  return lines.map((line,index)=>{
    const isLast=index===lastContentLine;
    const words=line.split(/\s+/).filter(Boolean);
    const emphasis=isLast?words.pop():undefined;
    const rest=words.join(' ');
    return (
      <Fragment key={index}>
        {index>0?<br/>:null}
        {rest}
        {rest&&emphasis?' ':null}
        {emphasis?<em>{emphasis}</em>:null}
      </Fragment>
    );
  });
}
export function HomeHero({hero}:{hero:Record<string,any>}){const slides=useMemo(()=>((Array.isArray(hero.slides)?hero.slides:[]) as Slide[]).filter(s=>s.url&&s.published!==false).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)),[hero.slides]);const useSlides=hero.mode==='slideshow'&&slides.length>0;const [current,setCurrent]=useState(0);useEffect(()=>{if(!useSlides||slides.length<2)return;const timer=setInterval(()=>setCurrent(value=>(value+1)%slides.length),Math.max(2000,Number(hero.slide_interval||5)*1000));return()=>clearInterval(timer)},[useSlides,slides.length,hero.slide_interval]);const title=String(hero.title||'Retratos que revelam você').trim();const focusStyle={'--hero-focus-desktop':`${hero.static_focus_x??50}% ${hero.static_focus_y??50}%`,'--hero-focus-mobile':`${hero.static_mobile_focus_x??hero.static_focus_x??50}% ${hero.static_mobile_focus_y??hero.static_focus_y??50}%`} as React.CSSProperties;return <header className="hero"><div className="hero-media">{useSlides? <div className="hero-slideshow is-active is-ready" aria-hidden="false">{slides.map((slide,index)=><div key={slide.url} className={`hero-slide${index===current?' is-visible':''}`} style={{backgroundImage:`url('${publicMediaUrl(slide.url,'images/hero-bg.jpg')}')`,backgroundPosition:`${slide.focus_x??50}% ${slide.focus_y??50}%`}}/>)}</div>:<picture><source media="(max-width: 899px)" srcSet={publicMediaUrl(hero.mobile_image,'images/hero-bg-mobile.jpg')}/><img src={publicMediaUrl(hero.desktop_image,'images/hero-bg.jpg')} alt={hero.image_alt||'Rangel Santos, fotógrafo'} className="hero-photo" style={focusStyle}/></picture>}<div className="hero-overlay"/></div><div className="container"><p id="hero-eyebrow" className="hero-eyebrow">{hero.eyebrow||''}</p><h1 id="hero-title" className="hero-title" data-published-text={title}>{renderHeroTitle(title)}</h1><p id="hero-description" className="hero-sub">{hero.description||''}</p><div className="hero-actions" style={{marginTop:36,display:'flex',gap:16,flexWrap:'wrap'}}><Link id="hero-primary-button" href={hero.primary_button?.url||'/galeria'} className="btn">{hero.primary_button?.text||'Ver galeria'}</Link><Link id="hero-secondary-button" href={hero.secondary_button?.url||'/contato'} className="btn btn-accent">{hero.secondary_button?.text||'Agendar sessão'}</Link></div><div className="hero-meta">{Array.isArray(hero.meta)&&hero.meta.map((item:any,index:number)=><div key={index}>{typeof item==='string'?<span>{item}</span>:<><strong>{item.label||''}</strong><span>{item.value||item.text||''}</span></>}</div>)}</div></div></header>}
