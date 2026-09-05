import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicNav } from '@/components/public-nav';
import { PublicFooter } from '@/components/public-footer';

export const metadata: Metadata = { title: 'Política de Privacidade', description: 'Como Rangel Santos Fotografia trata e protege dados pessoais.', alternates: { canonical: '/privacidade' } };

export default function PrivacyPage() {
  return <div className="native-page"><PublicNav active="" siteName="Rangel Santos Fotografia" />
    <main className="legal-page"><p className="section-eyebrow">RGPD · Privacidade</p><h1>Política de Privacidade</h1><p><strong>Última atualização:</strong> 5 de setembro de 2026.</p>
      <p>Esta política explica como os dados pessoais são tratados quando visita o site, envia uma mensagem, contrata um serviço fotográfico ou utiliza uma galeria privada.</p>
      <h2>1. Responsável pelo tratamento</h2><p>Rangel Santos Fotografia, com atividade em Vale de Cambra, Aveiro, Portugal. Para assuntos de privacidade, utilize <a href="mailto:rangelsantos1812@gmail.com">rangelsantos1812@gmail.com</a>.</p>
      <h2>2. Dados que podemos tratar</h2><ul><li>Nome, e-mail, telefone e conteúdo das mensagens enviadas.</li><li>Informações necessárias à marcação e execução do serviço.</li><li>Fotografias produzidas no âmbito do serviço contratado.</li><li>Login, senha da galeria, escolhas de fotografias e estado de entrega.</li><li>Registros técnicos de segurança, como tentativas de acesso e identificadores de rede transformados em código não reversível.</li><li>Estatísticas anónimas de visitas, somente quando autorizadas.</li></ul>
      <h2>3. Finalidades e fundamentos</h2><p>Os dados são utilizados para responder a pedidos, preparar propostas, executar contratos, disponibilizar galerias privadas, entregar fotografias, cumprir obrigações legais, prevenir abusos e proteger o site. Estatísticas opcionais dependem do consentimento, que pode ser recusado ou retirado.</p>
      <h2>4. Fotografias e galerias privadas</h2><p>As galerias são protegidas por credenciais individuais. As provas possuem marca de água e destinam-se exclusivamente à seleção. O cliente deve manter os dados de acesso confidenciais.</p>
      <h2>5. Conservação</h2><p>Os dados são conservados durante o período necessário ao atendimento, execução do serviço e cumprimento de obrigações legais. Galerias e fotografias são removidas conforme o prazo informado. Registros de segurança possuem retenção limitada. As preferências de privacidade são renovadas após seis meses.</p>
      <h2>6. Fornecedores</h2><p>Para operar o site poderão ser utilizados fornecedores de alojamento, base de dados, armazenamento, segurança, verificação humana e correio eletrónico, incluindo Vercel, Supabase, Cloudflare e Resend. Esses prestadores tratam somente os dados necessários aos seus serviços.</p>
      <h2>7. Estatísticas e tecnologias do navegador</h2><p>Os recursos essenciais permitem segurança, autenticação e funcionamento das preferências. Com autorização, o Vercel Web Analytics fornece contagens agregadas de visitas, páginas, origem aproximada, país, navegador e dispositivo. Não utilizamos esses dados para publicidade e as áreas <code>/admin</code> e <code>/area-cliente</code> são excluídas.</p>
      <h2>8. Seus direitos</h2><p>Pode solicitar acesso, retificação, apagamento, limitação, oposição ou portabilidade, quando aplicável. Também pode retirar o consentimento através de “Definições de privacidade” e reclamar à Comissão Nacional de Proteção de Dados.</p>
      <h2>9. Segurança e alterações</h2><p>São utilizadas medidas técnicas e organizacionais adequadas, mas nenhum sistema oferece risco zero. Esta política poderá ser atualizada; a data acima identifica a versão vigente.</p>
      <p><Link href="/">Voltar ao site</Link> · <Link href="/termos">Consultar os Termos de Uso</Link></p>
    </main><PublicFooter footerText="Rangel Santos Fotografia" instagram="https://instagram.com/photosrangel" whatsapp="351931159748" /></div>;
}
