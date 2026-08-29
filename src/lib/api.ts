/**
 * LegalDesk API client.
 *
 * One rule governs this file: it mirrors the backend that EXISTS, in
 * `src/routes/case.routes.ts`. It does not mirror `docs/API.md`, which
 * documents tasks, timeline, drafts, briefs and orders endpoints that
 * are not implemented. Endpoints we need but do not have are listed at
 * the bottom as comments, never as callable stubs.
 *
 * Envelope normalisation
 * ----------------------
 * The backend returns the payload under a different key per controller:
 * `{success, data}`, `{success, chat}`, `{success, chats}`,
 * `{success, hearing}`, `{success, hearings}`, `{success, resource}`,
 * `{success, result}`, `{success, token}`. Rather than make every caller
 * remember which, `request()` copies whichever key is present into
 * `data` while LEAVING THE ORIGINAL KEY IN PLACE. Existing call sites
 * that read `res.chats` keep working; new code reads `res.data` always.
 *
 * When the backend is normalised to `{success, data}` (see the code
 * reality report, Blocker 3), `normalise()` becomes a no-op and can be
 * deleted without touching a single caller.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

/* ────────────────────────────────────────────────────────────────────
   Types — derived from the repositories, not from documentation.
   ──────────────────────────────────────────────────────────────────── */

export type OrgRole = 'ADMIN' | 'EDITOR' | 'VIEWER';
export type CaseRole = 'ADMIN' | 'EDITOR' | 'VIEWER';
export type CaseStatus = 'OPEN' | 'CLOSED' | 'ARCHIVED';

/** `hearings.status`. NOTE: the reminder worker sets 'COMPLETED' once
 *  all three notifications have fired — roughly an hour BEFORE the
 *  hearing starts. Do not treat this as an outcome until that is fixed. */
export type HearingStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export type DocumentType = 'PDF' | 'LINK' | 'TEXT';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  created_at: string;
}

export interface Organisation {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  role?: OrgRole;
}

export interface OrgMember {
  user_id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: OrgRole;
  joined_at: string;
}

/** Shape returned by `GET /organisations/:id/cases`
 *  (`CaseRepository.listByUserAndOrg`). This is the Case Directory row. */
export interface CaseListItem {
  id: string;
  title: string;
  status: CaseStatus;
  case_number: string | null;
  court: string | null;
  next_hearing_date: string | null;
  created_at: string;
  role: CaseRole;
}

/** Shape returned by `GET /cases/:id` (`CaseRepository.findById`). */
export interface CaseDetail {
  id: string;
  organisation_id: string;
  title: string;
  description: string | null;
  status: CaseStatus;
  case_number: string | null;
  court: string | null;
  case_type: string | null;
  instructions: string | null;
  collection_id: string | null;
  filing_date: string | null;
  next_hearing_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseCreateBody {
  title: string;
  description?: string;
  case_number?: string;
  court?: string;
  case_type?: string;
  instructions?: string;
  filing_date?: string;
}

export interface CaseUpdateBody {
  title?: string;
  description?: string;
  status?: CaseStatus;
  court?: string;
  case_number?: string;
  case_type?: string;
  instructions?: string;
  next_hearing_date?: string;
}

export interface CaseMember {
  user_id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: CaseRole;
  joined_at: string;
}

export interface Hearing {
  id: string;
  case_id: string;
  date: string;
  notes: string;
  status: HearingStatus;
  notified_immediately: boolean;
  notified_24h: boolean;
  notified_1h: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatThread {
  id: string;
  case_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** A Hippocampus resource. There is no `documents` table — title and
 *  description live on the RAG resource, which is why they are the only
 *  metadata available. */
export interface DocumentResource {
  id?: string;
  _id?: string;
  title: string;
  description?: string | null;
  type?: DocumentType;
  url?: string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface Tool {
  id: string;
  case_id: string;
  script_id: string;
  title: string;
  description: string | null;
  webhook_url: string | null;
  openai_tool_json: unknown;
  created_at: string;
  updated_at: string;
}

/** Every response carries `data`; legacy keys are preserved alongside. */
export type ApiResponse<T> = {
  success: boolean;
  data: T;
} & Record<string, unknown>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/* ────────────────────────────────────────────────────────────────────
   Transport
   ──────────────────────────────────────────────────────────────────── */

/** Payload keys the backend uses instead of `data`, in priority order. */
const PAYLOAD_KEYS = ['data', 'chats', 'chat', 'hearings', 'hearing', 'resource', 'result', 'token'] as const;

function normalise<T>(body: unknown): ApiResponse<T> {
  if (body === null || typeof body !== 'object') {
    return { success: true, data: body as T };
  }
  const obj = body as Record<string, unknown>;
  if ('data' in obj) return obj as ApiResponse<T>;

  for (const key of PAYLOAD_KEYS) {
    if (key in obj) {
      // Preserve the original key so existing call sites keep working.
      return { ...obj, data: obj[key] as T } as ApiResponse<T>;
    }
  }
  return { ...obj, data: obj as unknown as T } as ApiResponse<T>;
}

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
}

function redirectToLogin(): never {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    window.location.href = '/login';
  }
  throw new ApiError('Session expired', 401, 'SESSION_EXPIRED');
}

async function toApiError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => ({}));
  const err = (body as Record<string, unknown>)?.error;
  if (err && typeof err === 'object') {
    const e = err as { code?: string; message?: string };
    return new ApiError(e.message || `API Error: ${res.status}`, res.status, e.code);
  }
  if (typeof err === 'string') return new ApiError(err, res.status);
  return new ApiError(`API Error: ${res.status}`, res.status);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = getToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Don't set Content-Type for FormData — the browser sets the boundary.
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers, credentials: 'include' });

  if (res.status === 401 && endpoint !== '/auth/refresh' && endpoint !== '/auth/login') {
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (!refreshRes.ok) redirectToLogin();

    const refreshed = await refreshRes.json();
    const newToken = refreshed?.data?.accessToken;
    if (!newToken) redirectToLogin();

    localStorage.setItem('accessToken', newToken);
    headers['Authorization'] = `Bearer ${newToken}`;

    const retry = await fetch(`${API_BASE}${endpoint}`, { ...options, headers, credentials: 'include' });
    if (!retry.ok) throw await toApiError(retry);
    return normalise<T>(await retry.json());
  }

  if (!res.ok) throw await toApiError(res);

  return normalise<T>(await res.json());
}

/* ────────────────────────────────────────────────────────────────────
   Auth
   ──────────────────────────────────────────────────────────────────── */

export const auth = {
  signup: (body: { name: string; email: string; password: string }) =>
    request<{ user: User; accessToken: string }>('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ user: User; accessToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  refresh: () => request<{ accessToken: string }>('/auth/refresh', { method: 'POST' }),
  logout: () => request<unknown>('/auth/logout', { method: 'POST' }),
  me: () => request<User>('/auth/me'),
};

/* ────────────────────────────────────────────────────────────────────
   Organisations
   ──────────────────────────────────────────────────────────────────── */

export const organisations = {
  list: () => request<Organisation[]>('/organisations'),
  create: (body: { name: string; description?: string }) =>
    request<Organisation>('/organisations', { method: 'POST', body: JSON.stringify(body) }),
  get: (id: string) => request<Organisation>(`/organisations/${id}`),
  update: (id: string, body: { name?: string; description?: string }) =>
    request<Organisation>(`/organisations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: string) => request<unknown>(`/organisations/${id}`, { method: 'DELETE' }),
  members: {
    list: (orgId: string) => request<OrgMember[]>(`/organisations/${orgId}/members`),
    add: (orgId: string, body: { email: string; role: OrgRole }) =>
      request<OrgMember>(`/organisations/${orgId}/members`, { method: 'POST', body: JSON.stringify(body) }),
    updateRole: (orgId: string, userId: string, body: { role: OrgRole }) =>
      request<OrgMember>(`/organisations/${orgId}/members/${userId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (orgId: string, userId: string) =>
      request<unknown>(`/organisations/${orgId}/members/${userId}`, { method: 'DELETE' }),
  },
};

/* ────────────────────────────────────────────────────────────────────
   Cases
   ──────────────────────────────────────────────────────────────────── */

export const cases = {
  list: (orgId: string) => request<CaseListItem[]>(`/organisations/${orgId}/cases`),
  create: (orgId: string, body: CaseCreateBody) =>
    request<CaseDetail>(`/organisations/${orgId}/cases`, { method: 'POST', body: JSON.stringify(body) }),
  get: (caseId: string) => request<CaseDetail>(`/cases/${caseId}`),
  update: (caseId: string, body: CaseUpdateBody) =>
    request<CaseDetail>(`/cases/${caseId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  /** Irreversible: also releases the Hippocampus collection, so the AI
   *  loses access to every document in the matter. Require typed
   *  confirmation of the case name at the call site. */
  delete: (caseId: string) => request<{ message: string }>(`/cases/${caseId}`, { method: 'DELETE' }),
  members: {
    list: (caseId: string) => request<CaseMember[]>(`/cases/${caseId}/members`),
    add: (caseId: string, body: { email: string; role: CaseRole }) =>
      request<CaseMember>(`/cases/${caseId}/members`, { method: 'POST', body: JSON.stringify(body) }),
    updateRole: (caseId: string, userId: string, body: { role: CaseRole }) =>
      request<CaseMember>(`/cases/${caseId}/members/${userId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (caseId: string, userId: string) =>
      request<unknown>(`/cases/${caseId}/members/${userId}`, { method: 'DELETE' }),
  },
};

/* ────────────────────────────────────────────────────────────────────
   Documents (Hippocampus resources)
   ──────────────────────────────────────────────────────────────────── */

export const documents = {
  list: (caseId: string) => request<{ resources?: DocumentResource[] } | DocumentResource[]>(`/cases/${caseId}/documents`),

  create: (caseId: string, body: FormData | { title: string; type: 'LINK'; url: string; description?: string } | { title: string; type: 'TEXT'; content: string; description?: string }) => {
    if (body instanceof FormData) {
      return request<DocumentResource>(`/cases/${caseId}/documents`, { method: 'POST', body });
    }
    return request<DocumentResource>(`/cases/${caseId}/documents`, { method: 'POST', body: JSON.stringify(body) });
  },

  /** Was missing from this client although the backend has implemented
   *  it since `document.controller.ts` landed. `content` is only honoured
   *  for TEXT resources; PDF and LINK content is immutable. */
  update: (
    caseId: string,
    resourceId: string,
    body: { title: string; description?: string; type?: DocumentType; content?: string },
  ) =>
    request<DocumentResource>(`/cases/${caseId}/documents/${resourceId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  /** Also missing from this client. Removes the resource from the case's
   *  vector collection, so the AI can no longer cite it. */
  delete: (caseId: string, resourceId: string) =>
    request<unknown>(`/cases/${caseId}/documents/${resourceId}`, { method: 'DELETE' }),
};

/* ────────────────────────────────────────────────────────────────────
   Chat
   ──────────────────────────────────────────────────────────────────── */

export const chat = {
  listThreads: (caseId: string) => request<ChatThread[]>(`/cases/${caseId}/chats`),
  createThread: (caseId: string, title?: string) =>
    request<ChatThread>(`/cases/${caseId}/chats`, {
      method: 'POST',
      body: JSON.stringify({ title: title || 'New Chat' }),
    }),
  /** History comes from Gateway's thread API, not from our database —
   *  there is no `messages` table. */
  getHistory: (caseId: string, chatId: string) =>
    request<ChatMessage[]>(`/cases/${caseId}/chats/${chatId}/history`),
  sendMessage: (caseId: string, chatId: string, message: string) =>
    request<unknown>(`/cases/${caseId}/chats/${chatId}/message`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  /**
   * Streaming completion over SSE.
   *
   * Deliberately left as-is apart from typing and an abort signal: it
   * already handles `data:` prefixes, partial lines split across chunks,
   * a trailing buffer with no newline, and 401-refresh-retry. That is
   * the hard part and it works.
   */
  sendMessageStream: async (
    caseId: string,
    chatId: string,
    message: string,
    onDelta: (chunk: string) => void,
    onDone?: (usage: unknown) => void,
    signal?: AbortSignal,
  ): Promise<void> => {
    let token = getToken();

    const makeRequest = (accessToken: string | null) =>
      fetch(`${API_BASE}/cases/${caseId}/chats/${chatId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ message }),
        signal,
      });

    let res = await makeRequest(token);

    if (res.status === 401) {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!refreshRes.ok) redirectToLogin();

      const data = await refreshRes.json();
      token = data?.data?.accessToken ?? null;
      if (!token) redirectToLogin();

      localStorage.setItem('accessToken', token);
      res = await makeRequest(token);
    }

    if (!res.ok || !res.body) throw await toApiError(res);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const handleLine = (raw: string) => {
      let trimmed = raw.trim();
      if (!trimmed) return;
      if (trimmed.startsWith('data:')) trimmed = trimmed.substring(5).trim();
      if (!trimmed) return;

      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.event === 'delta' && parsed.content !== undefined) {
          onDelta(parsed.content);
        } else if (parsed.event === 'done') {
          onDone?.(parsed.usage);
        }
      } catch (err) {
        console.error('SSE parse error on line:', trimmed, err);
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep the incomplete last line
        for (const line of lines) handleLine(line);
      }
    } finally {
      reader.releaseLock();
    }

    if (buffer.trim()) handleLine(buffer);
  },
};

/* ────────────────────────────────────────────────────────────────────
   Hearings
   ──────────────────────────────────────────────────────────────────── */

export const hearings = {
  list: (caseId: string) => request<Hearing[]>(`/cases/${caseId}/hearings`),
  /** The backend rejects any date in the past. See the note below. */
  create: (caseId: string, body: { date: string; notes?: string }) =>
    request<Hearing>(`/cases/${caseId}/hearings`, { method: 'POST', body: JSON.stringify(body) }),
};

/* ────────────────────────────────────────────────────────────────────
   Tools (Viasocket)
   ──────────────────────────────────────────────────────────────────── */

export const tools = {
  list: (caseId: string) => request<Tool[]>(`/cases/${caseId}/tools`),
  createOrUpdate: (caseId: string, body: Record<string, unknown>) =>
    request<Tool>(`/cases/${caseId}/tools`, { method: 'POST', body: JSON.stringify(body) }),
  delete: (caseId: string, scriptId: string) =>
    request<unknown>(`/cases/${caseId}/tools/${scriptId}`, { method: 'DELETE' }),
  getToken: (caseId: string) => request<string>(`/cases/${caseId}/tools/token`),
};

/* ══════════════════════════════════════════════════════════════════
   NOT YET AVAILABLE — do not add stubs for these.
   Deliberately left as comments so nothing calls an endpoint that
   returns 404 in production. Each blocks a named P0 screen.

   1. PATCH /hearings/:id
      Blocks: Hearing Update, the post-court flow.
      Needs { date?, notes?, status?, outcome? }. Additionally,
      POST /cases/:id/hearings must stop rejecting past dates
      (case.controller equivalent: hearing.controller.ts line ~24)
      or a hearing that already happened can never be recorded.

   2. GET /organisations/:id/agenda?from=&to=
      Blocks: Today, and the mobile home screen.
      Upcoming hearings across all cases the user can see, joined to
      case title / court / case_number. Without it the client must
      issue one request per case.

   3. Tasks, timeline events, drafts, stored notifications.
      Blocks: Needs Attention, case Timeline, Draft Workspace,
      notification centre. No tables, no routes — Tier B in the
      blueprint. `case_events` first; it is the cheapest and unlocks
      the most.
   ══════════════════════════════════════════════════════════════════ */
