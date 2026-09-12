export function normalizeWhatsAppPhone(value?: string | null): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return '';
  if (/(0{7,}|9{8,}|1{8,})$/.test(digits)) return '';
  return digits;
}

export function buildWhatsAppDraftUrl(text: string, phone?: string | null): string {
  const draft = String(text || '').trim();
  if (!draft) return '';
  const normalized = normalizeWhatsAppPhone(phone);
  const encoded = encodeURIComponent(draft);
  return normalized
    ? `https://wa.me/${normalized}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

export function openWhatsAppDraft(text: string, phone?: string | null): string {
  const url = buildWhatsAppDraftUrl(text, phone);
  if (!url || typeof window === 'undefined') return url;
  const mobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  if (mobile) window.location.assign(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
  return url;
}
