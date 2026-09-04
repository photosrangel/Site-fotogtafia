/** Contrato do domínio Mensagens para a migração Next.js. */
export interface MessageRecord {
  id: string;
  nome: string;
  email?: string | null;
  tipo?: string | null;
  mensagem: string;
  lida: boolean;
  created_at: string;
}

export const messageFeature = {
  name: 'messages',
  parityRequired: true,
  currentRuntime: [
    'js/features/messages/messages-repository.js',
    'js/features/messages/messages-controller.js'
  ]
} as const;
