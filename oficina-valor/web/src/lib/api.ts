const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/** Bump ao mudar modelo de auth/seed para invalidar sessões antigas. */
const TOKEN_KEY = 'ov_token_v2';
const USER_KEY = 'ov_user_v2';

export type User = {
  id: string;
  email: string;
  nome: string;
  papeis: string[];
};

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

let token: string | null = localStorage.getItem(TOKEN_KEY);
let currentUser: User | null = (() => {
  // limpa chaves antigas (pré-v2) que causavam "Token inválido"
  localStorage.removeItem('ov_token');
  localStorage.removeItem('ov_user');
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
})();

const authListeners = new Set<(user: User | null) => void>();

export function onAuthChange(cb: (user: User | null) => void) {
  authListeners.add(cb);
  return () => {
    authListeners.delete(cb);
  };
}

function notifyAuth() {
  for (const cb of authListeners) cb(currentUser);
}

export function getUser() {
  return currentUser;
}

export function setSession(t: string, user: User) {
  token = t;
  currentUser = user;
  localStorage.setItem(TOKEN_KEY, t);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifyAuth();
}

export function clearSession() {
  token = null;
  currentUser = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('ov_token');
  localStorage.removeItem('ov_user');
  notifyAuth();
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  opts?: { skipAuth?: boolean },
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (!opts?.skipAuth) {
    if (token) headers.set('Authorization', `Bearer ${token}`);
    else if (currentUser) headers.set('X-Dev-User', currentUser.email);
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      msg = JSON.parse(text).message ?? text;
    } catch {
      /* ignore */
    }
    const message = Array.isArray(msg) ? msg.join(', ') : String(msg);
    if (
      res.status === 401 ||
      /token inválido|não autenticado|unauthorized/i.test(message)
    ) {
      clearSession();
      throw new AuthError(message);
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.blob() as Promise<T>;
}

export const api = {
  apiUrl: API_URL,
  naoUrl: import.meta.env.VITE_NAO_URL || 'http://localhost:5006',
  login: (email: string) =>
    request<{ accessToken: string; user: User }>(
      '/auth/dev-login',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
      { skipAuth: true },
    ),
  /** Renova JWT a partir do e-mail em sessão (ou gerente padrão). */
  async ensureSession(email = 'gerente@oficina.local') {
    const target = currentUser?.email || email;
    const res = await api.login(target);
    setSession(res.accessToken, res.user);
    return res.user;
  },
  projetos: () => request<any[]>('/projetos'),
  projeto: (id: string) => request<any>(`/projetos/${id}`),
  analytics: (id: string) => request<any>(`/projetos/${id}/analytics`),
  criarProjetoRapido: (body: {
    nome: string;
    areaNome: string;
    investimento?: number;
    prazoMeses?: number;
    problema?: string;
    valorMensalEsperado?: number;
    status?: string;
  }) =>
    request<any>('/projetos/rapido', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  atualizarStatusProjeto: (id: string, status: string) =>
    request<any>(`/projetos/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  atualizarAvaliacaoFapd: (
    id: string,
    body: {
      notaOe1?: number | null;
      notaOe3?: number | null;
      notaOe4?: number | null;
      notaOe5Sust?: number | null;
      notaOe5Tech?: number | null;
      naOe1?: boolean;
      naOe3?: boolean;
      naOe4?: boolean;
      naOe5Sust?: boolean;
      naOe5Tech?: boolean;
      papelEstrategico?: 'estruturante' | 'gerador' | null;
      comentarioFapd?: string | null;
    },
  ) =>
    request<any>(`/projetos/${id}/avaliacao-fapd`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  atualizarAnotacoesProjeto: (
    id: string,
    body: {
      memoriaCalculoGanho?: string | null;
      comentarios?: string | null;
      opexGerado?: number | null;
    },
  ) =>
    request<any>(`/projetos/${id}/anotacoes`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  removerProjeto: (id: string) =>
    request<{ ok: boolean; id: string; nome: string }>(`/projetos/${id}`, {
      method: 'DELETE',
    }),
  portfolio: () => request<any>('/portfolio/resumo'),
  pendentes: () => request<any[]>('/medicoes/pendentes'),
  criarMedicao: (
    beneficioId: string,
    body: {
      periodoReferencia: string;
      valorRealizado: number;
      comentario?: string;
    },
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
  validar: (
    medicaoId: string,
    decisao: 'aprovada' | 'rejeitada',
    comentario?: string,
  ) =>
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
    body: {
      periodoReferencia: string;
      valor: number;
      centroCustoCodigo?: string;
    },
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
  naoStatus: () => request<any>('/nao/status'),
  askNao: (question: string) =>
    request<any>('/nao/ask', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
  storyNao: () => request<any>('/nao/story', { method: 'POST', body: '{}' }),
  startWizard: (
    projetoId: string,
    body: {
      tipo: 'baseline' | 'realizacao';
      respondenteNome?: string;
      conheceProjeto?: boolean;
    },
  ) =>
    request<any>(`/projetos/${projetoId}/wizards`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  completeWizard: (id: string, body: Record<string, unknown>) =>
    request<any>(`/wizards/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  encaminharWizard: (
    id: string,
    body: { encaminhadoPara: string; respondenteNome?: string },
  ) =>
    request<any>(`/wizards/${id}/encaminhar`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listWizards: (projetoId: string) =>
    request<any[]>(`/projetos/${projetoId}/wizards`),
  agentsOverview: () => request<any>('/agents/overview'),
  agentsRecommendations: (params?: { agent?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.agent) q.set('agent', params.agent);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<any[]>(`/agents/recommendations${qs ? `?${qs}` : ''}`);
  },
  agentsActivity: (params?: { agent?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.agent) q.set('agent', params.agent);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<any[]>(`/agents/activity${qs ? `?${qs}` : ''}`);
  },
  agentsScan: () => request<any>('/agents/scan', { method: 'POST', body: '{}' }),
  agentsAccept: (id: string) =>
    request<any>(`/agents/recommendations/${id}/accept`, {
      method: 'POST',
      body: '{}',
    }),
  agentsReject: (id: string) =>
    request<any>(`/agents/recommendations/${id}/reject`, {
      method: 'POST',
      body: '{}',
    }),
  agentsSetMode: (mode: 'assisted' | 'automated') =>
    request<any>('/agents/mode', {
      method: 'PATCH',
      body: JSON.stringify({ mode }),
    }),
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

export function brl(n: number | string | null | undefined) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(n ?? 0));
}
