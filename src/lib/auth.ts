const BASE_URL = 'https://app.fyso.dev';
const TENANT_ID = import.meta.env.PUBLIC_TENANT_ID || 'consultorio';

export async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/tenant/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { success: false, error: data?.message || 'Credenciales invalidas' };
    }

    const data = await res.json();
    const token = data.data?.token || data.token;
    if (!token) return { success: false, error: 'No se recibio token' };

    localStorage.setItem('consultorio_token', token);
    const user = data.data?.user || data.user || { email };
    localStorage.setItem('consultorio_user', JSON.stringify(user));

    return { success: true };
  } catch {
    return { success: false, error: 'Error de conexion' };
  }
}

export function logout() {
  localStorage.removeItem('consultorio_token');
  localStorage.removeItem('consultorio_user');
  window.location.href = '/login';
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('consultorio_token');
}

export function getUser(): any {
  try {
    const raw = localStorage.getItem('consultorio_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function getToken(): string | null {
  return localStorage.getItem('consultorio_token');
}
