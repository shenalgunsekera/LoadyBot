/**
 * Receipt images in Supabase Storage (a private bucket). Server-side only — uses
 * the service_role key. Everything no-ops gracefully when storage isn't
 * configured, so the bots still work without it.
 */
const URL = () => process.env.SUPABASE_URL;
const KEY = () => process.env.SUPABASE_SERVICE_KEY;
const BUCKET = () => process.env.SUPABASE_RECEIPTS_BUCKET ?? 'receipts';

export function storageConfigured(): boolean {
  return !!(URL() && KEY());
}

function headers() {
  const k = KEY()!;
  return { apikey: k, Authorization: `Bearer ${k}` };
}

const extFor = (ct: string) => (ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('pdf') ? 'pdf' : 'jpg');

/** Upload a receipt for a fill; returns the storage path (bucket-relative), or null. */
export async function uploadReceipt(accountId: string, fillId: string, bytes: Uint8Array, contentType: string): Promise<string | null> {
  if (!storageConfigured()) return null;
  const path = `${accountId}/${fillId}/${Date.now()}.${extFor(contentType)}`;
  const res = await fetch(`${URL()}/storage/v1/object/${BUCKET()}/${path}`, {
    method: 'POST', headers: { ...headers(), 'content-type': contentType }, body: bytes as unknown as BodyInit,
  });
  if (!res.ok) { console.error('[storage] upload failed', await res.text().catch(() => '')); return null; }
  return path;
}

/** A short-lived signed URL to view a stored receipt, or null. */
export async function signedReceiptUrl(storagePath: string, expiresIn = 300): Promise<string | null> {
  if (!storageConfigured() || !storagePath) return null;
  const res = await fetch(`${URL()}/storage/v1/object/sign/${BUCKET()}/${storagePath}`, {
    method: 'POST', headers: { ...headers(), 'content-type': 'application/json' }, body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { signedURL?: string };
  return j.signedURL ? `${URL()}/storage/v1${j.signedURL}` : null;
}
