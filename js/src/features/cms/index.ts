export type SiteContentRow<T = Record<string, unknown>> = {
  id?: string;
  slug: string;
  section_key: string;
  content: T;
  updated_at?: string;
};

export type SiteSettings = {
  site_name?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  instagram_url?: string | null;
  location?: string | null;
  specialty?: string | null;
  availability?: string | null;
  footer_text?: string | null;
};
