"use client";

import { tracked } from "./warming";

export type ProfileInput = {
  display_name: string;
  age: number;
  gender: "woman" | "man" | "other";
  seeking: "woman" | "man" | "all";
  area: string;
  job: string;
  bio: string;
  date_style: string;
  interests: string[];
  availability: string[];
  min_preferred_age: number;
  max_preferred_age: number;
  max_distance_km: number;
  referral_code?: string;
  terms_agreed: boolean;
  privacy_agreed: boolean;
  adult_confirmed: boolean;
  marketing_opt_in: boolean;
};

export type ProfileDetailsInput = Omit<
  ProfileInput,
  | "referral_code"
  | "terms_agreed"
  | "privacy_agreed"
  | "adult_confirmed"
  | "marketing_opt_in"
>;

export type ProfilePhoto = {
  id: string;
  url: string;
  content_type: string;
  byte_size?: number;
  position: number;
  is_public?: boolean;
  moderation_status?: "pending" | "approved" | "rejected";
  moderation_reason?: string | null;
};

export type DiscoverProfile = {
  id: string;
  display_name: string;
  age: number;
  area: string;
  job: string;
  bio: string;
  date_style: string;
  interests: string[];
  availability: string[];
  common_interests: string[];
  common_times: string[];
  compatibility: number;
  discovery_score: number;
  photos: ProfilePhoto[];
  photo_count: number;
  photo_prompt: string;
  account_verified: boolean;
  saved: boolean;
  distance_km: number | null;
  match_reasons: string[];
};

export type ReceivedInterest = DiscoverProfile & {
  liked_at: string;
};

export type MatchItem = {
  id: string;
  person: DiscoverProfile;
  matched_at: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  last_active_at: string;
};

export type ChatMessage = {
  id: string;
  client_id: string | null;
  sender_id: string;
  body: string;
  attachment_url?: string | null;
  attachment_content_type?: string | null;
  attachment_byte_size?: number | null;
  mine: boolean;
  created_at: string;
  read_at: string | null;
  sending?: boolean;
  failed?: boolean;
};

export type RealtimeEvent =
  | { type: "ready"; match_id: string; user_id: string; heartbeat_seconds: number }
  | { type: "message"; match_id: string; item: Omit<ChatMessage, "mine"> & { mine: null } }
  | { type: "read"; match_id: string; reader_id: string; read_at: string; count: number }
  | { type: "typing"; match_id: string; user_id: string; active: boolean }
  | { type: "presence"; match_id: string; user_id: string; online: boolean }
  | {
      type: "match_sync_updated";
      match_id: string;
      round: number;
      status: "active" | "completed";
      current_round: number;
    }
  | { type: "match_closed"; match_id: string; closed_by_id: string; reason: string }
  | { type: "pong" }
  | { type: "inbox_ready"; user_id: string; heartbeat_seconds: number }
  | { type: "interest_created" }
  | { type: "notification"; item: NotificationItem }
  | { type: "error"; detail: string; client_id?: string | null };

export type NotificationItem = {
  id: string;
  kind: "match" | "message" | "date" | "safety" | string;
  title: string;
  body: string;
  action_type: string | null;
  action_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type AccountSettings = {
  discoverable: boolean;
  marketing_opt_in: boolean;
  notify_matches: boolean;
  notify_messages: boolean;
  notify_dates: boolean;
  min_preferred_age: number;
  max_preferred_age: number;
  max_distance_km: number;
  legal_complete: boolean;
  terms_version: string | null;
  privacy_version: string | null;
  current_terms_version: string;
  current_privacy_version: string;
  adult_confirmed: boolean;
  status: "active" | "suspended" | "banned";
  suspended_until: string | null;
};

export type MyReport = {
  id: string;
  category: string;
  status: "pending" | "resolved" | "dismissed";
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type DiscoverFilters = {
  area?: string;
  min_age?: number;
  max_age?: number;
  availability?: string;
  interest?: string;
  photo_only?: boolean;
};

export type DatePlan = {
  id: string;
  title: string;
  area: string;
  scheduled_for: string;
  note: string | null;
  place_id: string | null;
  place_name: string | null;
  place_url: string | null;
  road_address: string | null;
  longitude: number | null;
  latitude: number | null;
  status: "pending" | "accepted" | "declined";
  mine: boolean;
  my_safe_confirmed: boolean;
  feedback_submitted: boolean;
  created_at: string;
};

export type MatchSyncPrompt = {
  round: number;
  text: string;
};

export type MatchSyncAnswer = {
  mine: boolean;
  answer: string;
};

export type MatchSyncRevealedRound = {
  round: number;
  prompt: string;
  answers: MatchSyncAnswer[];
};

export type MatchSyncSummary = {
  common_interests: string[];
  common_times: string[];
  first_date_idea: string;
};

export type MatchSyncSession = {
  id: string;
  status: "active" | "completed";
  current_round: number;
  total_rounds: number;
  prompts: MatchSyncPrompt[];
  revealed_rounds: MatchSyncRevealedRound[];
  my_answer: string | null;
  current_round_answers: number;
  waiting_for_partner: boolean;
  can_answer: boolean;
  summary: MatchSyncSummary | null;
  started_at: string;
  completed_at: string | null;
};

export type AuthProvider = {
  id: "kakao" | "naver" | "google";
  label: string;
  configured: boolean;
  status: "planned" | "active";
};

export type VerificationStatus = {
  verified: boolean;
  status: "unverified" | "pending" | "verified" | "rejected";
  verified_at: string | null;
  request: {
    id: string;
    method: string;
    status: "pending" | "approved" | "rejected";
    note: string | null;
    requested_at: string;
    reviewed_at: string | null;
  } | null;
};

export type ReferralSummary = {
  code: string;
  invite_url: string;
  invited_count: number;
  redeemed: boolean;
};

export type AuthConfiguration = {
  native: string | null;
  turnstile_required: boolean;
  turnstile_site_key: string | null;
  kakao_map_js_key: string | null;
  providers: AuthProvider[];
};

export type KakaoPlace = {
  id: string;
  name: string;
  category: string;
  phone: string;
  address: string;
  place_url: string;
  longitude: number;
  latitude: number;
};

const READ_REQUEST_TIMEOUT_MS = 8_000;
const WRITE_REQUEST_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MESSAGE =
  "요청 시간이 초과됐어요. 잠시 후 다시 시도해주세요.";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return tracked(async () => {
    const controller = new AbortController();
    const externalSignal = init?.signal;
    const timeoutMs =
      (init?.method || "GET").toUpperCase() === "GET" ||
      (init?.method || "GET").toUpperCase() === "HEAD"
        ? READ_REQUEST_TIMEOUT_MS
        : WRITE_REQUEST_TIMEOUT_MS;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortExternal = () => controller.abort(externalSignal?.reason);
    if (externalSignal) {
      if (externalSignal.aborted) abortExternal();
      else externalSignal.addEventListener("abort", abortExternal, { once: true });
    }
    try {
      const response = await fetch(path, {
        ...init,
        signal: controller.signal,
        credentials: "include",
        headers: {
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
          ...init?.headers,
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || `요청을 처리하지 못했어요 (${response.status})`);
      }
      if (response.status === 204) return undefined as T;
      return response.json();
    } catch (error) {
      if (controller.signal.aborted && !externalSignal?.aborted) {
        throw new Error(REQUEST_TIMEOUT_MESSAGE);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortExternal);
    }
  });
}

export const saveProfile = (profile: ProfileInput) =>
  api<{ status: string }>("/api/profile", { method: "PUT", body: JSON.stringify(profile) });
export const updateProfile = (profile: ProfileDetailsInput) =>
  api<{ status: string; profile_complete: true }>("/api/profile", {
    method: "PATCH",
    body: JSON.stringify(profile),
  });
export const fetchDiscover = (
  filters: DiscoverFilters = {},
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams({ limit: "12" });
  if (filters.area) params.set("area", filters.area);
  if (filters.min_age) params.set("min_age", String(filters.min_age));
  if (filters.max_age) params.set("max_age", String(filters.max_age));
  if (filters.availability) params.set("availability", filters.availability);
  if (filters.interest) params.set("interest", filters.interest);
  if (filters.photo_only) params.set("photo_only", "true");
  return api<{ items: DiscoverProfile[]; has_more: boolean }>(
    `/api/discover?${params.toString()}`,
    { signal },
  );
};
export const fetchSavedProfiles = () =>
  api<{ items: DiscoverProfile[] }>("/api/saved-profiles?limit=50");
export const fetchReceivedInterests = () =>
  api<{ items: ReceivedInterest[]; has_more: boolean }>("/api/interests/received?limit=12");
export const saveProfileForLater = (targetId: string) =>
  api<{ status: string; saved: boolean }>(`/api/saved-profiles/${targetId}`, {
    method: "POST",
  });
export const removeSavedProfile = (targetId: string) =>
  api<{ status: string; saved: boolean; removed: boolean }>(
    `/api/saved-profiles/${targetId}`,
    { method: "DELETE" },
  );
export const sendSwipe = (targetId: string, decision: "like" | "pass") =>
  api<{ matched: boolean; match_id?: string; person?: string }>("/api/swipes", {
    method: "POST", body: JSON.stringify({ target_id: targetId, decision }),
  });
export const fetchMatches = () => api<{ items: MatchItem[] }>("/api/matches?limit=30");
export const fetchMessages = (matchId: string) =>
  api<{ items: ChatMessage[] }>(`/api/matches/${matchId}/messages`);
export const sendMessage = (
  matchId: string,
  body: string,
  clientId = crypto.randomUUID(),
  attachmentDataUrl?: string,
) =>
  api<ChatMessage>(`/api/matches/${matchId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      body,
      client_id: clientId,
      ...(attachmentDataUrl ? { attachment_data_url: attachmentDataUrl } : {}),
    }),
  });
export const markMessagesRead = (matchId: string) =>
  api<{ status: string; count: number; read_at: string }>(`/api/matches/${matchId}/read`, { method: "POST" });
export function matchSocketUrl(matchId: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/ws/matches/${matchId}`;
}
export function inboxSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/ws/inbox`;
}
export const fetchDatePlans = (matchId: string) =>
  api<{ items: DatePlan[] }>(`/api/matches/${matchId}/plans`);
export const fetchMatchSync = (matchId: string) =>
  api<{ started: boolean; session: MatchSyncSession | null }>(
    `/api/matches/${matchId}/sync`,
  );
export const startMatchSync = (matchId: string) =>
  api<{ started: boolean; session: MatchSyncSession }>(
    `/api/matches/${matchId}/sync/start`,
    { method: "POST" },
  );
export const answerMatchSync = (
  matchId: string,
  round: number,
  answer: string,
) =>
  api<{ started: boolean; session: MatchSyncSession }>(
    `/api/matches/${matchId}/sync/answers`,
    { method: "POST", body: JSON.stringify({ round, answer }) },
  );
export const createDatePlan = (
  matchId: string,
  plan: Omit<
    DatePlan,
    | "id"
    | "status"
    | "mine"
    | "my_safe_confirmed"
    | "feedback_submitted"
    | "created_at"
  >,
) =>
  api<{ item: DatePlan }>(`/api/matches/${matchId}/plans`, { method: "POST", body: JSON.stringify(plan) });
export const respondDatePlan = (matchId: string, planId: string, status: "accepted" | "declined") =>
  api<{ item: DatePlan }>(`/api/matches/${matchId}/plans/${planId}/respond`, { method: "POST", body: JSON.stringify({ status }) });
export const confirmDateSafe = (matchId: string, planId: string) =>
  api<{ item: DatePlan }>(`/api/matches/${matchId}/plans/${planId}/safe`, {
    method: "POST",
  });
export const submitDateFeedback = (
  matchId: string,
  planId: string,
  feedback: {
    attended: boolean;
    felt_safe: boolean;
    would_meet_again: boolean;
    note: string;
  },
) =>
  api<{ status: string; safety_follow_up_recommended: boolean }>(
    `/api/matches/${matchId}/plans/${planId}/feedback`,
    { method: "POST", body: JSON.stringify(feedback) },
  );
export const closeMatch = (matchId: string, reason = "not_fit") =>
  api<{ status: string }>(`/api/matches/${matchId}/close`, { method: "POST", body: JSON.stringify({ reason }) });
export const blockUser = (userId: string) =>
  api<{ status: string }>("/api/safety/block", { method: "POST", body: JSON.stringify({ user_id: userId }) });
export const reportUser = (userId: string, category: string, detail: string) =>
  api<{ status: string }>("/api/safety/report", { method: "POST", body: JSON.stringify({ user_id: userId, category, detail, block: true }) });

const retryDelay = (attempt: number) =>
  new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));

export async function fetchAuthProviders(): Promise<AuthConfiguration> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4_000);
    try {
      return await api<AuthConfiguration>("/api/auth/providers", {
        signal: controller.signal,
      });
    } catch (error) {
      lastError = error;
      if (attempt < 1) await retryDelay(attempt);
    } finally {
      window.clearTimeout(timer);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("로그인 서버에 연결하지 못했어요.");
}
export const startSocialLogin = (
  provider: AuthProvider["id"],
  turnstileToken: string,
  returnTo = "/",
) =>
  api<{ authorization_url: string }>(`/api/auth/${provider}/start`, {
    method: "POST",
    body: JSON.stringify({ turnstile_token: turnstileToken, return_to: returnTo }),
  });
export const signOut = () => api<void>("/api/auth/logout", { method: "POST" });
export const searchKakaoPlaces = (query: string) =>
  api<{ items: KakaoPlace[]; query: string }>(`/api/places/search?q=${encodeURIComponent(query)}`);

export const uploadProfilePhoto = (dataUrl: string) =>
  api<{ photo: ProfilePhoto }>("/api/profile/photos", {
    method: "POST",
    body: JSON.stringify({ data_url: dataUrl, is_public: true }),
  });

export const saveConsents = (input: {
  terms_agreed: boolean;
  privacy_agreed: boolean;
  adult_confirmed: boolean;
  marketing_opt_in: boolean;
}) => api<{ status: string; settings: AccountSettings }>("/api/account/consents", {
  method: "POST",
  body: JSON.stringify(input),
});
export const fetchAccountSettings = () => api<AccountSettings>("/api/account/settings");
export const updateAccountSettings = (input: Partial<Pick<AccountSettings,
  | "discoverable"
  | "marketing_opt_in"
  | "notify_matches"
  | "notify_messages"
  | "notify_dates"
  | "min_preferred_age"
  | "max_preferred_age"
  | "max_distance_km"
>>) => api<{ status: string; settings: AccountSettings }>("/api/account/settings", {
  method: "PATCH",
  body: JSON.stringify(input),
});
export const fetchMyReports = () => api<{ items: MyReport[] }>("/api/account/reports");
export const fetchVerificationStatus = () =>
  api<VerificationStatus>("/api/verification");
export const requestVerification = (note = "") =>
  api<VerificationStatus>("/api/verification/request", {
    method: "POST",
    body: JSON.stringify({ note }),
  });
export const fetchReferralSummary = () =>
  api<ReferralSummary>("/api/growth/referral");
export const redeemReferralCode = (code: string) =>
  api<ReferralSummary>("/api/growth/referral/redeem", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
export async function downloadAccountData(): Promise<void> {
  const response = await fetch("/api/account/export", { credentials: "include" });
  if (!response.ok) throw new Error("데이터 파일을 만들지 못했어요");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "morrow-account-data.json";
  link.click();
  URL.revokeObjectURL(url);
}
export const deleteAccount = () => api<{ status: string }>("/api/account", {
  method: "DELETE",
  body: JSON.stringify({ confirmation: "MORROW 탈퇴" }),
});

export const fetchNotifications = () =>
  api<{ items: NotificationItem[]; unread_count: number }>("/api/notifications");
export const readNotification = (notificationId: string) =>
  api<{ status: string }>(`/api/notifications/${notificationId}/read`, { method: "POST" });
export const readAllNotifications = () =>
  api<{ status: string; count: number }>("/api/notifications/read-all", { method: "POST" });

export type AdminOverview = {
  users: number;
  pending_reports: number;
  pending_photos: number;
  pending_verifications: number;
  restricted_users: number;
};
export type AdminReport = {
  id: string;
  reporter_name: string;
  reported_user_id: string;
  reported_name: string;
  reported_status: string;
  category: string;
  detail: string | null;
  priority: string;
  status: string;
  created_at: string;
};
export type AdminPhoto = {
  id: string;
  owner_id: string;
  owner_name: string;
  url: string;
  byte_size: number;
  status: string;
  created_at: string;
};
export type AdminVerification = {
  id: string;
  user_id: string;
  display_name: string;
  age: number | null;
  area: string | null;
  method: string;
  status: string;
  note: string | null;
  photo_url: string | null;
  social_providers: string[];
  requested_at: string;
};
export const fetchAdminOverview = () => api<AdminOverview>("/api/admin/overview");
export const fetchAdminReports = () => api<{ items: AdminReport[] }>("/api/admin/reports");
export const resolveAdminReport = (reportId: string, resolution: "dismiss" | "warn" | "suspend_7d" | "ban", note = "") =>
  api<{ status: string; resolution: string }>(`/api/admin/reports/${reportId}/resolve`, {
    method: "POST", body: JSON.stringify({ resolution, note }),
  });
export const fetchAdminPhotos = () => api<{ items: AdminPhoto[] }>("/api/admin/photos");
export const moderateAdminPhoto = (photoId: string, decision: "approved" | "rejected", reason = "") =>
  api<{ status: string }>(`/api/admin/photos/${photoId}/moderate`, {
    method: "POST", body: JSON.stringify({ decision, reason }),
  });
export const fetchAdminVerifications = () =>
  api<{ items: AdminVerification[] }>("/api/admin/verifications");
export const reviewAdminVerification = (
  requestId: string,
  decision: "approved" | "rejected",
  note = "",
) =>
  api<{ status: string; verified: boolean }>(
    `/api/admin/verifications/${requestId}/review`,
    { method: "POST", body: JSON.stringify({ decision, note }) },
  );
export const deleteProfilePhoto = (photoId: string) =>
  api<{ status: string }>(`/api/profile/photos/${photoId}`, { method: "DELETE" });
export const makePrimaryPhoto = (photoId: string) =>
  api<{ photo: ProfilePhoto }>(`/api/profile/photos/${photoId}/primary`, { method: "POST" });

