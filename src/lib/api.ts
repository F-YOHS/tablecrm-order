const BASE_URL = 'https://app.tablecrm.com/api/v1';

export function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('tablecrm_token') || '';
}

export function setToken(token: string) {
  localStorage.setItem('tablecrm_token', token);
}

export function clearToken() {
  localStorage.removeItem('tablecrm_token');
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const url = `${BASE_URL}${path}${path.includes('?') ? '&' : '?'}token=${token}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function extractList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['result', 'items', 'results', 'data']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
  }
  return [];
}

export async function searchContragents(phone: string) {
  const data = await apiFetch(`/contragents/?phone=${encodeURIComponent(phone)}`);
  return extractList(data);
}

export async function getWarehouses() {
  const data = await apiFetch('/warehouses/');
  return extractList(data);
}

export async function getPayboxes() {
  const data = await apiFetch('/payboxes/');
  return extractList(data);
}

export async function getOrganizations() {
  const data = await apiFetch('/organizations/');
  return extractList(data);
}

export async function getPriceTypes() {
  const data = await apiFetch('/price_types/');
  return extractList(data);
}

export async function getNomenclature(search: string) {
  const data = await apiFetch(`/nomenclature/?search=${encodeURIComponent(search)}`);
  return extractList(data);
}

export async function createSale(payload: Record<string, unknown>) {
  const token = getToken();
  const url = `${BASE_URL}/docs_sales/?token=${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
