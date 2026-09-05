import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicNav } from '@/components/public-nav';
import { PublicFooter } from '@/components/public-footer';

export const metadata: Metadata = { title: 'Termos de Uso', description: 'Termos de utilização do site e da área privada.', alternates: { canonical: '/termos' } };

export default function TermsPage() {
  return <div className="native-page"><PublicNav active="" siteName="Rangel Santos Fotografia" />
    <main className="legal-page"><p className="section-eyebrow">Informação legal</p><h1>Termos de Uso</h1><p><strong>Última atualização:</strong> 5 de setembro de 2026.</p>
      <p>Ao navegar neste site ou utilizar uma galeria privada, o visitante concorda em respeitar estes termos. As condições específicas de cada sessão permanecem definidas no respetivo orçamento ou contrato.</p>
      <h2>1. Conteúdo do site</h2><p>Textos, fotografias, identidade visual e demais conteúdos pertencem a Rangel Santos Fotografia ou são utilizados com autorização. Não é permitido copiar, alterar, redistribuir, vender ou utilizar esse conteúdo sem autorização prévia.</p>
      <h2>2. Informações e disponibilidade</h2><p>O site apresenta portfólio e informações gerais. Conteúdos, disponibilidade, valores e prazos poderão ser atualizados. Uma contratação somente fica confirmada conforme as condições acordadas diretamente com o fotógrafo.</p>
      <h2>3. Área do cliente</h2><p>O login e a senha da galeria são pessoais. O cliente deve mantê-los confidenciais e comunicar qualquer suspeita de acesso indevido. Poderão ser aplicados limites e verificações de segurança contra tentativas abusivas.</p>
      <h2>4. Fotografias de prova</h2><p>As provas destinam-se apenas à seleção, podem não representar o tratamento final e não devem ser publicadas, editadas, copiadas nem ter a marca de água removida. A autorização de uso das fotografias finais segue o contrato.</p>
      <h2>5. Seleção e entrega</h2><p>Após a confirmação, a seleção poderá tornar-se definitiva para início da edição. O cliente deve descarregar os arquivos finais no prazo informado e conservar uma cópia própria após a entrega.</p>
      <h2>6. Condutas proibidas</h2><p>Não é permitido contornar controles de acesso, explorar falhas, realizar acessos automatizados abusivos, interferir no site ou utilizar dados e imagens de terceiros sem autorização.</p>
      <h2>7. Serviços externos</h2><p>O funcionamento depende de serviços de alojamento, armazenamento, segurança, verificação e e-mail. Poderão ocorrer indisponibilidades temporárias por manutenção ou eventos fora do controlo razoável.</p>
      <h2>8. Privacidade</h2><p>O tratamento de dados está explicado na <Link href="/privacidade">Política de Privacidade</Link>. O visitante pode rever escolhas opcionais através de “Definições de privacidade”.</p>
      <h2>9. Contacto</h2><p>Dúvidas podem ser enviadas para <a href="mailto:rangelsantos1812@gmail.com">rangelsantos1812@gmail.com</a>.</p>
      <p><Link href="/">Voltar ao site</Link> · <Link href="/privacidade">Consultar a Política de Privacidade</Link></p>
    </main><PublicFooter footerText="Rangel Santos Fotografia" instagram="https://instagram.com/photosrangel" whatsapp="351931159748" /></div>;
}
