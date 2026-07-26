const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export type User = {
  id: string;
  email: string;
  nome: string;
  papeis: string[];
};

let token: string | null = localStorage.getItem('ov_token');
let currentUser: User | null = (() => {
  const raw = localStorage.getItem('ov_user');
  return raw ? (JSON.parse(raw) as User) : null;
})();

export function getUser() {
  return currentUser;
}

export function setSession(t: string, user: User) {
  token = t;
  currentUser = user;
  localStorage.setItem('ov_token', t);
  localStorage.setItem('ov_user', JSON.stringify(user));
}

export function clearSession() {
  token = null;
  currentUser = null;
  localStorage.removeItem('ov_token');
  localStorage.removeItem('ov_user');
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);
  else if (currentUser) headers.set('X-Dev-User', currentUser.email);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      msg = JSON.parse(text).message ?? text;
    } catch {
      /* ignore */
    }
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.blob() as Promise<T>;
}

export const api = {
  apiUrl: API_URL,
  naoUrl: import.meta.env.VITE_NAO_URL || 'http://localhost:5006',
  devUsers: () => request<User[]>('/auth/dev-users'),
  login: (email: string) =>
    request<{ accessToken: string; user: User }>('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  projetos: () => request<any[]>('/projetos'),
  projeto: (id: string) => request<any>(`/projetos/${id}`),
  analytics: (id: string) => request<any>(`/projetos/${id}/analytics`),
  portfolio: () => request<any>('/portfolio/resumo'),
  pendentes: () => request<any[]>('/medicoes/pendentes'),
  criarMedicao: (
    beneficioId: string,
    body: { periodoReferencia: string; valorRealizado: number; comentario?: string },
  ) =>
    request(`/beneficios/${beneficioId}/medicoes`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  uploadEvidencia: (medicaoId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request(`/medicoes/${medicaoId}/evidencias`, {
      method: 'POST',
      body: fd,
    });
  },
  submeter: (medicaoId: string) =>
    request(`/medicoes/${medicaoId}/submeter`, { method: 'POST', body: '{}' }),
  validar: (medicaoId: string, decisao: 'aprovada' | 'rejeitada', comentario?: string) =>
    request(`/medicoes/${medicaoId}/validacao`, {
      method: 'POST',
      body: JSON.stringify({ decisao, comentario }),
    }),
  estornar: (medicaoId: string, justificativa: string) =>
    request(`/medicoes/${medicaoId}/estorno`, {
      method: 'POST',
      body: JSON.stringify({ justificativa }),
    }),
  gate: (
    projetoId: string,
    body: { gate: string; decisao: string; comentario?: string },
  ) =>
    request(`/projetos/${projetoId}/gates`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  premissas: (projetoId: string, ok: boolean, comentario?: string) =>
    request(`/projetos/${projetoId}/premissas`, {
      method: 'POST',
      body: JSON.stringify({ ok, comentario }),
    }),
  custo: (
    projetoId: string,
    body: { periodoReferencia: string; valor: number; centroCustoCodigo?: string },
  ) =>
    request(`/projetos/${projetoId}/custos`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  importCustos: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/integracoes/erp/custos', { method: 'POST', body: fd });
  },
  importLegado: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/integracoes/legado', { method: 'POST', body: fd });
  },
  syncNao: () => request<any>('/nao/sync', { method: 'POST', body: '{}' }),
  auditoria: () => request<any[]>('/auditoria'),
  exportGanhos: async () => {
    const blob = (await request<Blob>('/relatorios/ganhos')) as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ganhos-oficina-valor.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  },
};

export function brl(n: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(n ?? 0));
}
