export function publicMediaUrl(value: unknown, fallback: string): string {
  const raw = String(value ?? fallback).trim();

  if (!raw) return '';
  if (/^(?:https?:)?\/\//i.test(raw) || /^(?:data|blob):/i.test(raw)) return raw;

  const normalized = raw.replace(/^\/+/, '');

  const imageFolder = normalized.toLowerCase().indexOf('images/');
  if (imageFolder >= 0) return `/${normalized.slice(imageFolder)}`;

  return `/${normalized}`;
}
