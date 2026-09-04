/** Contratos do domínio Ensaios/Área do Cliente para a migração Next.js. */
export type SessionStatus =
  | 'preparando'
  | 'aguardando_selecao'
  | 'selecao_finalizada'
  | 'selecionado'
  | 'em_edicao'
  | 'fotos_disponiveis'
  | 'entregue';

export interface SessionRecord {
  id: string;
  titulo: string;
  cliente_nome?: string | null;
  cliente_email?: string | null;
  cliente_telefone?: string | null;
  categoria?: string | null;
  slug: string;
  codigo_acesso: string;
  status: SessionStatus;
  capa_foto_id?: string | null;
  created_at?: string;
}

export interface SessionPhotoRecord {
  id: string;
  ensaio_id: string;
  url: string;
  tipo: 'prova' | 'final';
  ordem: number;
  selecionada?: boolean;
}

export const sessionFeature = {
  name: 'sessions',
  parityRequired: true,
  currentRuntime: [
    'js/features/sessions/sessions-repository.js',
    'js/features/sessions/session-photos-repository.js',
    'js/features/sessions/sessions-controller.js'
  ]
} as const;
