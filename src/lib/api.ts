const BASE_URL = 'https://app.fyso.dev';
const TENANT_ID = import.meta.env.TENANT_ID || 'consultorio';
const API_TOKEN = import.meta.env.FYSO_API_TOKEN;

if (!API_TOKEN) {
  throw new Error('FYSO_API_TOKEN env var is not set');
}

async function apiFetch(entity: string, params: Record<string, string> = {}): Promise<any[]> {
  const token = API_TOKEN;
  const query = new URLSearchParams({ limit: '200', ...params });
  const url = `${BASE_URL}/api/entities/${entity}/records?${query}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': TENANT_ID,
    },
  });

  if (!res.ok) {
    console.error(`Failed to fetch ${entity}: ${res.status}`);
    return [];
  }

  const json = await res.json();
  return json?.data?.data || [];
}

// Helper to safely get nested record data
export function field(record: any, key: string): any {
  return record?.data?.[key] ?? null;
}

export async function fetchServices() { return apiFetch('services'); }
export async function fetchAppointments() { return apiFetch('appointments'); }

export async function fetchSiteConfig(): Promise<Record<string, any>> {
  const records = await apiFetch('site_config');
  if (records.length === 0) return {};
  return records[0]?.data || {};
}

// Build a lookup map from records: id -> record
export function buildLookup(records: any[]): Record<string, any> {
  const map: Record<string, any> = {};
  for (const r of records) {
    if (r.id) map[r.id] = r;
  }
  return map;
}

// Get display name for a record (works for any entity)
export function getRecordDisplayName(record: any): string {
  if (!record) return 'N/A';
  // Has a 'name' field in data?
  if (record.data?.name) return record.data.name;
  // Has first_name/last_name?
  const first = record.data?.first_name || '';
  const last = record.data?.last_name || '';
  if (first || last) return `${first} ${last}`.trim();
  // Fallback to top-level name
  if (record.name && record.name !== 'Untitled Record') return record.name;
  return 'N/A';
}

// Resolve a relation field using a lookup map
export function resolve(record: any, relKey: string, lookup: Record<string, any>): any {
  const id = record?.data?.[relKey];
  if (!id || typeof id !== 'string') return null;
  return lookup[id] || null;
}

// Resolve and get display name
export function resolveDisplayName(record: any, relKey: string, lookup: Record<string, any>): string {
  const related = resolve(record, relKey, lookup);
  return getRecordDisplayName(related);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function formatPrice(price: number | null): string {
  if (price == null) return 'N/A';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(price);
}
