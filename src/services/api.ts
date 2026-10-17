import {
  User,
  Quiz,
  Question,
  QuizAttempt,
  LiveParticipant,
  LeaderboardEntry,
  LearningHub,
  HubMaterial,
  HubMember,
  StudentAnalytics,
  AdminStats,
  ScoreScale,
  SystemSettings,
  PaymentRequest,
  CreatorSummary,
  CreatorAccessStatus,
  Registration,
} from '../types.ts';

const API_BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach the signed login token so the server knows who is calling
  try {
    const token = localStorage.getItem('remedi_auth_token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  } catch {}

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data?.error || `Request failed with status ${res.status}`;
    const error: any = new Error(errorMsg);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

export const api = {
  // Auth
  async register(data: { email: string; password: string; fullName: string; role?: string }) {
    return request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async login(data: { email: string; password: string }) {
    return request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async adminResetPassword(userId: string) {
    return request<{ tempPassword: string; email: string }>(`/admin/users/${userId}/reset-password`, {
      method: 'POST',
    });
  },

  async resetPassword(data: { email: string; newPassword: string; currentPassword?: string }) {
    return request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateProfile(id: string, data: { fullName?: string; bio?: string; role?: string }) {
    return request<{ user: User }>(`/users/${id}/profile`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Quizzes
  async getQuizzes(creatorId?: string) {
    const q = creatorId ? `?creatorId=${encodeURIComponent(creatorId)}` : '';
    return request<{ quizzes: Quiz[] }>(`/quizzes${q}`);
  },

  async getQuiz(idOrCode: string, examCode?: string) {
    const q = examCode ? `?code=${encodeURIComponent(examCode)}` : '';
    return request<{ quiz: Quiz }>(`/quizzes/${encodeURIComponent(idOrCode)}${q}`);
  },

  async createQuiz(data: {
    creatorId: string;
    creatorName: string;
    title: string;
    description: string;
    coverImage?: string;
    subjects: string[];
    compulsorySubjects: string[];
    optionalSubjects: string[];
    requiredOptionalCount: number;
    durationMinutes: number | null;
    scoreScale: ScoreScale;
    accessType: 'public' | 'private';
    maxAttempts?: number;
    listedPublicly?: boolean;
    opensAt?: string | null;
    windowHours?: number;
    leaderboardEnabled: boolean;
    questions: Partial<Question>[];
  }) {
    return request<{ quiz: Quiz; questions: Question[] }>('/quizzes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateQuiz(id: string, data: Omit<Partial<Quiz>, 'questions'> & { questions?: Partial<Question>[] }) {
    return request<{ quiz: Quiz; questions: Question[] }>(`/quizzes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteQuiz(id: string) {
    try {
      return await request<{ success: boolean; message: string; deletedId: string; verifiedDeleted: boolean }>(
        `/quizzes/${id}`,
        { method: 'DELETE' }
      );
    } catch (err: any) {
      if (err.status === 404) {
        // Confirm non-existence: verify with backend
        try {
          await request(`/quizzes/${id}`);
          // If it somehow returned ok, it wasn't deleted
          throw err;
        } catch (checkErr: any) {
          if (checkErr.status === 404) {
            // Verified that it really does not exist!
            return { success: true, message: 'Quiz verified non-existent.', deletedId: id, verifiedDeleted: true };
          }
        }
      }
      throw err;
    }
  },

  // CBT Flow
  async registerForQuiz(idOrCode: string, data: { name: string; email: string; phone: string }) {
    return request<{ registration: { code: string; name: string; email: string }; quiz: { id: string; title: string } }>(
      `/quizzes/${encodeURIComponent(idOrCode)}/register`,
      { method: 'POST', body: JSON.stringify(data) }
    );
  },

  async listRegistrations(quizId: string) {
    return request<{ registrations: Registration[] }>(`/quizzes/${encodeURIComponent(quizId)}/registrations`);
  },

  async addRegistration(quizId: string, data: { name: string; email: string; phone: string }) {
    return request<{ registration: Registration }>(`/quizzes/${encodeURIComponent(quizId)}/registrations`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async cancelRegistration(quizId: string, regId: string) {
    return request<{ ok: boolean }>(
      `/quizzes/${encodeURIComponent(quizId)}/registrations/${encodeURIComponent(regId)}`,
      { method: 'DELETE' }
    );
  },

  async verifyCode(quizId: string, code: string) {
    return request<{ name: string; email: string; used?: boolean }>('/cbt/verify-code', {
      method: 'POST',
      body: JSON.stringify({ quizId, code }),
    });
  },

  async checkAccess(quizId: string, email: string) {
    return request<{
      canAttempt: boolean;
      priorAttempt: QuizAttempt | null;
      quiz: Quiz;
      schedule?: { status: 'upcoming' | 'open' | 'closed'; opensAt: string | null; closesAt: string | null };
    }>('/cbt/check-access', {
      method: 'POST',
      body: JSON.stringify({ quizId, email }),
    });
  },

  async startSession(data: {
    quizId: string;
    participantName: string;
    participantEmail: string;
    selectedSubjects: string[];
    accessCode?: string;
  }) {
    return request<{ session: any }>('/cbt/start-session', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async sendHeartbeat(data: { quizId: string; participantEmail: string; currentQuestionIndex: number }) {
    return request<{ ok: boolean }>('/cbt/heartbeat', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async submitAttempt(data: {
    quizId: string;
    participantName: string;
    participantEmail: string;
    userId?: string;
    selectedSubjects: string[];
    answers: Record<string, string>;
    timeUsedSeconds: number;
    startedAt: string;
    accessCode?: string;
  }) {
    return request<{ attempt: QuizAttempt }>('/cbt/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getAttempt(id: string) {
    return request<{ attempt: QuizAttempt; quiz: Quiz; questions: Question[] }>(`/cbt/attempt/${id}`);
  },

  async resetAttempt(params: { attemptId?: string; quizId?: string; participantEmail?: string }) {
    return request<{ success: boolean; message: string }>('/cbt/reset-attempt', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // Live participants
  async getLiveParticipants(quizId: string) {
    return request<{ count: number; participants: LiveParticipant[] }>(`/quizzes/${quizId}/live-participants`);
  },

  // Leaderboard
  async getLeaderboard(quizId: string) {
    return request<{
      quizTitle: string;
      leaderboardEnabled: boolean;
      scoreScale: number;
      leaderboard: LeaderboardEntry[];
    }>(`/quizzes/${quizId}/leaderboard`);
  },

  async hideLeaderboardParticipant(quizId: string, attemptId: string) {
    return request<{ success: boolean }>(`/quizzes/${quizId}/leaderboard/hide-participant`, {
      method: 'PUT',
      body: JSON.stringify({ attemptId }),
    });
  },

  // Learning Hubs
  async getHubs(q?: string) {
    return request<{ hubs: LearningHub[] }>(`/hubs${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  },

  async getHub(idOrCode: string) {
    return request<{
      hub: LearningHub & {
        members: HubMember[];
        materials: HubMaterial[];
        quizzes: Quiz[];
      };
    }>(`/hubs/${encodeURIComponent(idOrCode)}`);
  },

  async createHub(data: Record<string, any>) {
    return request<{ hub: LearningHub }>('/hubs', { method: 'POST', body: JSON.stringify(data) });
  },

  async updateHub(id: string, data: Record<string, any>) {
    return request<{ hub: LearningHub }>(`/hubs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deleteHub(id: string) {
    return request<{ ok: boolean }>(`/hubs/${id}`, { method: 'DELETE' });
  },

  async joinHub(hubId: string, subjects: string[]) {
    return request<{ success: boolean; status?: string; member?: HubMember; message?: string }>(`/hubs/${hubId}/join`, {
      method: 'POST',
      body: JSON.stringify({ subjects }),
    });
  },

  async setHubMemberStatus(hubId: string, memberId: string, status: 'active' | 'rejected') {
    return request<{ ok: boolean }>(`/hubs/${hubId}/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  async removeHubMember(hubId: string, memberId: string) {
    return request<{ ok: boolean }>(`/hubs/${hubId}/members/${memberId}`, { method: 'DELETE' });
  },

  async setMySubjects(hubId: string, subjects: string[]) {
    return request<{ ok: boolean; subjects: string[] }>(`/hubs/${hubId}/my-subjects`, {
      method: 'PUT',
      body: JSON.stringify({ subjects }),
    });
  },

  async addMaterial(hubId: string, data: {
    creatorId: string;
    title: string;
    description: string;
    type: 'note' | 'tutorial' | 'guide' | 'quiz_link';
    content: string;
    quizId?: string;
  }) {
    return request<{ material: HubMaterial }>(`/hubs/${hubId}/materials`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getHubPerformance(hubId: string) {
    return request<{
      hubTitle?: string;
      performance: {
        memberId: string;
        name: string;
        email: string;
        joinedAt: string;
        quizzesTaken: number;
        averageScore: string;
        latestAttempt: any;
      }[];
    }>(`/hubs/${hubId}/performance`);
  },

  // Student Analytics
  async getStudentAnalytics(email: string) {
    return request<StudentAnalytics>(`/analytics/student/${encodeURIComponent(email)}`);
  },

  // Admin
  async getAdminStats() {
    return request<AdminStats>('/admin/stats');
  },

  async getUsers() {
    return request<{ users: User[] }>('/users');
  },

  async toggleUserDisabled(id: string) {
    return request<{ id: string; disabled: boolean }>(`/users/${id}/toggle-disabled`, {
      method: 'PUT',
    });
  },

  async getAdminSettings() {
    return request<{ settings: SystemSettings }>('/admin/settings');
  },

  async updateAdminSettings(settings: Partial<SystemSettings>) {
    return request<{ settings: SystemSettings }>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  async getAdminCreators(query?: { code?: string; search?: string }) {
    const params = new URLSearchParams();
    if (query?.code) params.set('code', query.code);
    if (query?.search) params.set('search', query.search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ creators: CreatorSummary[] }>(`/admin/creators${qs}`);
  },

  async getAdminCreator(idOrCode: string) {
    return request<{
      creator: CreatorSummary;
      quizzes: Quiz[];
      hubs: LearningHub[];
      paymentRequests: PaymentRequest[];
      recentAttempts: QuizAttempt[];
    }>(`/admin/creators/${encodeURIComponent(idOrCode)}`);
  },

  async activateAdminCreator(id: string, durationDays: number, notes?: string) {
    return request<{ creator: User; message: string }>(`/admin/creators/${id}/activate`, {
      method: 'POST',
      body: JSON.stringify({ durationDays, notes }),
    });
  },

  async setAdminCreatorExpiry(id: string, expiresAt: string) {
    return request<{ creator: User; message: string }>(`/admin/creators/${id}/set-expiry`, {
      method: 'POST',
      body: JSON.stringify({ expiresAt }),
    });
  },

  async toggleAdminCreatorAccess(id: string) {
    return request<{ creator: User }>(`/admin/creators/${id}/toggle-access`, {
      method: 'PUT',
    });
  },

  async getAdminPaymentRequests(status?: string) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<{ requests: PaymentRequest[] }>(`/admin/payment-requests${qs}`);
  },

  async verifyPaymentRequest(id: string, durationDays?: number) {
    return request<{ request: PaymentRequest; creator?: User; message: string }>(
      `/admin/payment-requests/${id}/verify`,
      {
        method: 'POST',
        body: JSON.stringify({ durationDays }),
      }
    );
  },

  async rejectPaymentRequest(id: string, reason: string) {
    return request<{ request: PaymentRequest; message: string }>(
      `/admin/payment-requests/${id}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
  },

  async deletePaymentRequest(id: string) {
    return request<{ success: boolean }>(`/admin/payment-requests/${id}`, {
      method: 'DELETE',
    });
  },

  // Creator Access & Payment Workflows
  async getCreatorAccessStatus() {
    return request<CreatorAccessStatus>('/creator/access-status');
  },

  async submitCreatorPayment(data: {
    amount: number;
    senderName: string;
    senderBank?: string;
    referenceNumber: string;
    notes?: string;
    receiptUrl?: string;
  }) {
    return request<{ request: PaymentRequest; message: string }>('/creator/payment-request', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
