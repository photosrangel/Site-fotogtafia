import { createSupabaseServerClient } from '@/lib/supabase/server';

export type VisualOverride = {
  text?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  size?: 'inherit' | 'small' | 'large';
  size_scale?: number;
  x?: number;
  y?: number;
  mobile?: {
    bold?: boolean;
    italic?: boolean;
    align?: 'left' | 'center' | 'right';
    size?: 'inherit' | 'small' | 'large';
    size_scale?: number;
    x?: number;
    y?: number;
  };
};

export type PublishedDesignConfig = {
  inline_styles?: Record<string, VisualOverride>;
  whatsapp_enabled?: boolean;
  whatsapp_number?: string;
  whatsapp_message?: string;
  whatsapp_position?: 'left' | 'right';
  whatsapp_style?: 'editorial' | 'minimal' | 'classic';
  whatsapp_pages?: string[];
};

export async function getPublishedDesignConfig(): Promise<PublishedDesignConfig> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return {};

  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client
      .from('site_content')
      .select('content')
      .eq('slug', 'design')
      .eq('section_key', 'published')
      .limit(1)
      .maybeSingle();

    if (error || !data?.content) return {};
    const content = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
    return content && typeof content === 'object' ? content as PublishedDesignConfig : {};
  } catch {
    return {};
  }
}

export async function getPublishedVisualOverrides(): Promise<Record<string, VisualOverride>> {
  const content = await getPublishedDesignConfig();
  return content.inline_styles && typeof content.inline_styles === 'object' ? content.inline_styles : {};
}
