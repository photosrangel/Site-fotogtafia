/**
 * Contrato do domínio Categorias para a futura migração Next.js.
 * Nesta fase o runtime continua em js/features/categories para manter
 * compatibilidade total com o site em produção.
 */
export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  published: boolean;
  sort_order: number;
}

export const categoryFeature = {
  name: 'categories',
  parityRequired: true,
  currentRuntime: [
    'js/features/categories/categories-repository.js',
    'js/features/categories/categories-controller.js'
  ]
} as const;
