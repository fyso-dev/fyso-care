const BASE_URL = 'https://app.fyso.dev';
const TENANT_ID = import.meta.env.PUBLIC_TENANT_ID || 'consultorio';
const TOKEN_KEY = `${TENANT_ID}_token`;
const USER_KEY = `${TENANT_ID}_user`;

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

    localStorage.setItem(TOKEN_KEY, token);
    const user = data.data?.user || data.user || { email };
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    return { success: true };
  } catch {
    return { success: false, error: 'Error de conexion' };
  }
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = '/login';
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

export function getUser(): any {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
