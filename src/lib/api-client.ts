const BASE_URL = 'https://app.fyso.dev';
const TENANT_ID = import.meta.env.PUBLIC_TENANT_ID || 'consultorio';
const TOKEN_KEY = `${TENANT_ID}_token`;
const USER_KEY = `${TENANT_ID}_user`;

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-ID': TENANT_ID,
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function handleUnauthorized() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = '/login';
}

export async function apiList(entity: string, params: Record<string, string> = {}): Promise<{ data: any[]; total: number }> {
  const query = new URLSearchParams({ limit: '200', ...params });
  const res = await fetch(`${BASE_URL}/api/entities/${entity}/records?${query}`, {
    headers: getHeaders(),
  });
  if (res.status === 401) { handleUnauthorized(); return { data: [], total: 0 }; }
  if (!res.ok) throw new Error(`Failed to fetch ${entity}: ${res.status}`);
  const json = await res.json();
  const data = json?.data?.data || [];
  const total = json?.data?.pagination?.total || data.length;
  return { data, total };
}

export async function apiGet(entity: string, id: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/entities/${entity}/records/${id}`, {
    headers: getHeaders(),
  });
  if (res.status === 401) { handleUnauthorized(); return null; }
  if (!res.ok) throw new Error(`Failed to get ${entity}/${id}: ${res.status}`);
  const json = await res.json();
  return json?.data || null;
}

export async function apiCreate(entity: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/entities/${entity}/records`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (res.status === 401) { handleUnauthorized(); return null; }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create ${entity}: ${res.status} ${text}`);
  }
  const json = await res.json();
  return json?.data || json;
}

// Partial update — sends only the fields provided (PATCH semantics)
export async function apiUpdate(entity: string, id: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/entities/${entity}/records/${id}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (res.status === 401) { handleUnauthorized(); return null; }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update ${entity}/${id}: ${res.status} ${text}`);
  }
  const json = await res.json();
  return json?.data || json;
}

// Full replacement — overwrites the entire record (PUT semantics)
export async function apiReplace(entity: string, id: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/entities/${entity}/records/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (res.status === 401) { handleUnauthorized(); return null; }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to replace ${entity}/${id}: ${res.status} ${text}`);
  }
  const json = await res.json();
  return json?.data || json;
}

export async function apiDelete(entity: string, id: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/entities/${entity}/records/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (res.status === 401) { handleUnauthorized(); return false; }
  if (!res.ok) throw new Error(`Failed to delete ${entity}/${id}: ${res.status}`);
  return true;
}

export async function apiSearch(entity: string, query: string, limit = 10): Promise<any[]> {
  if (!query || query.length < 2) return [];
  const params = new URLSearchParams({ search: query, limit: String(limit) });
  const res = await fetch(`${BASE_URL}/api/entities/${entity}/records?${params}`, {
    headers: getHeaders(),
  });
  if (res.status === 401) { handleUnauthorized(); return []; }
  if (!res.ok) return [];
  const json = await res.json();
  return json?.data?.data || [];
}

// Re-export helpers
export function field(record: any, key: string): any {
  return record?.data?.[key] ?? null;
}

export function buildLookup(records: any[]): Record<string, any> {
  const map: Record<string, any> = {};
  for (const r of records) {
    if (r.id) map[r.id] = r;
  }
  return map;
}

export function getRecordDisplayName(record: any): string {
  if (!record) return 'N/A';
  if (record.data?.name) return record.data.name;
  const first = record.data?.first_name || '';
  const last = record.data?.last_name || '';
  if (first || last) return `${first} ${last}`.trim();
  if (record.name && record.name !== 'Untitled Record') return record.name;
  return 'N/A';
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return dateStr; }
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
}

// Fyso Scheduling API
export async function apiGetAvailableSlots(profesionalId: string, desde: string, hasta?: string): Promise<any[]> {
  const query = new URLSearchParams({ profesional_id: profesionalId, desde, hasta: hasta || desde });
  const res = await fetch(`${BASE_URL}/api/scheduling/available-slots?${query}`, {
    headers: getHeaders(),
  });
  if (res.status === 401) { handleUnauthorized(); return []; }
  if (!res.ok) return [];
  const json = await res.json();
  return json?.data || [];
}

export function formatPrice(price: number | null): string {
  if (price == null) return 'N/A';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 0,
  }).format(price);
}
