import Link from 'next/link';
import { PublicNav } from '@/components/public-nav';
import { PublicFooter } from '@/components/public-footer';
import { HomeHero } from '@/components/home-hero';
import { getNativePageData } from '@/lib/site-content';
import { getRecentPhotos } from '@/lib/public-gallery';
/*
 * Rede de segurança: mesmo que a revalidação sob demanda (chamada pelo
 * botão "Publicar alterações no site" do painel) falhe por qualquer
 * motivo (sessão expirada, falha de rede, domínio de preview), esta
 * página nunca fica desatualizada por mais de 30 segundos. Sem isto, a
 * página é gerada uma única vez em build e só muda se a revalidação sob
 * demanda funcionar — foi o que causava publicações "sem efeito".
 */
export const revalidate = 30;
export default async function HomePage(){const [{settings,content}]=await Promise.all([getNativePageData('inicio')]);
/*
 * Antes, o título/textos do hero eram misturados com um possível texto
 * salvo em "design.published.inline_styles" (usado pelos controles de
 * estilo — negrito, tamanho, alinhamento — do editor visual). O
 * problema: assim que qualquer publicação antiga chegasse a gravar um
 * texto ali (mesmo por engano, em versões anteriores do painel), esse
 * texto ficava "grudado" para sempre, porque o código não tinha como
 * saber qual dos dois era o mais recente — e sempre priorizava o valor
 * salvo em inline_styles, ignorando qualquer atualização feita depois
 * em content.hero.*. Isso é exatamente o que travava o título mesmo
 * após publicar. Agora o texto do hero usa SEMPRE content.hero.* como
 * única fonte da verdade — o inline_styles continua existindo, mas só
 * para aplicar estilo (negrito/itálico/alinhamento/tamanho/posição),
 * nunca para decidir qual texto mostrar (ver components/published-visual-design.tsx).
 */
const hero=content.hero||{};
const recent=content.recent_work||{};const photos=await getRecentPhotos(Number(recent.gallery_limit)||6);return <div className="native-page"><PublicNav active="/" siteName={settings.site_name}/><HomeHero hero={hero}/><section className="section recent-work-section"><div className="container"><div className="section-head"><div><p id="recent-work-eyebrow" className="section-eyebrow">{recent.eyebrow||''}</p><h2 id="recent-work-title" className="section-title">{recent.title||''}</h2></div><Link id="recent-work-button" href={recent.button?.url||'/galeria'} className="btn">{recent.button?.text||'Galeria completa →'}</Link></div><div className="grid gallery-adaptive-grid recent-work-grid">{photos.map((photo,index)=><div className="frame" data-category={photo.gallery_id} key={photo.id}><img src={photo.image_url} alt={photo.alt_text||'Fotografia de retrato feminino'} loading={index<3?'eager':'lazy'}/><span className="frame-num">{String(index+1).padStart(2,'0')}</span><div className="frame-caption"><span>{photo.alt_text||''}</span></div></div>)}</div></div></section><PublicFooter footerText={settings.footer_text} instagram={settings.instagram_url} whatsapp={settings.whatsapp}/></div>}
