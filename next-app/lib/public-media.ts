export function publicMediaUrl(value: unknown, fallback: string): string {
  const raw = String(value ?? fallback).trim();

  if (!raw) return '';
  if (/^(?:https?:)?\/\//i.test(raw) || /^(?:data|blob):/i.test(raw)) return raw;

  const normalized = raw.replace(/^\/+/, '');

  if (/^legacy\/images\//i.test(normalized)) {
    return `/${normalized.replace(/^legacy\//i, '')}`;
  }

  return `/${normalized}`;
}
