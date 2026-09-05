import type {MetadataRoute} from 'next';
export default function robots():MetadataRoute.Robots{return{rules:{userAgent:'*',allow:'/',disallow:['/admin','/area-cliente','/legacy/admin-v2.html','/legacy/area-cliente.html']},sitemap:'https://photosrangel.pt/sitemap.xml',host:'https://photosrangel.pt'}}
