"use client";

import {
  ArrowLeft,
  Bell,
  Bookmark,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Pencil,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

import { SignOutLink } from "@/components/SignIn";
import { AccountCenter } from "@/components/AccountCenter";
import { ConsentGate } from "@/components/ConsentGate";
import { NotificationCenter } from "@/components/NotificationCenter";
import { compressImage, ProfilePhotos } from "@/components/ProfilePhotos";
import { ProfileEditor } from "@/components/ProfileEditor";
import { PlacePicker } from "@/components/PlacePicker";
import { SafetyCenter } from "@/components/SafetyCenter";
import { MatchSyncPanel } from "@/components/MatchSyncPanel";
import {
  getMatchNextView,
  MorrowPulse,
  type DrawerView,
} from "@/components/MorrowPulse";
import { ReceivedInterestSection } from "@/components/ReceivedInterestSection";
import {
  blockUser,
  closeMatch,
  DiscoverProfile,
  fetchDiscover,
  fetchSavedProfiles,
  fetchMatches,
  fetchDatePlans,
  fetchMessages,
  MatchItem,
  ReceivedInterest,
  ProfilePhoto,
  ProfileInput,
  reportUser,
  saveProfile,
  sendMessage,
  sendSwipe,
  createDatePlan,
  respondDatePlan,
  confirmDateSafe,
  submitDateFeedback,
  DatePlan,
  DiscoverFilters,
  ChatMessage,
  RealtimeEvent,
  markMessagesRead,
  matchSocketUrl,
  fetchNotifications,
  fetchReceivedInterests,
  inboxSocketUrl,
  NotificationItem,
  readAllNotifications,
  readNotification,
  removeSavedProfile,
  saveProfileForLater,
  type KakaoPlace,
} from "@/lib/api";
import { AREA_OPTIONS as areas, DISTANCE_OPTIONS } from "@/lib/dating-options";
import { Me } from "@/lib/identity";

type Tab = "discover" | "matches" | "activity" | "profile" | "safety" | "saved";
const interests = [
  "카페",
  "전시",
  "맛집",
  "산책",
  "러닝",
  "영화",
  "음악",
  "여행",
  "독서",
  "요리",
  "반려동물",
  "운동",
];
const times = [
  "평일 저녁",
  "금요일 밤",
  "토요일 낮",
  "토요일 저녁",
  "일요일 낮",
  "일요일 저녁",
];
const discoveryCategories = [
  {
    icon: Sparkles,
    label: "추천",
    value: "전체",
    description: "나를 위한 큐레이션",
  },
  {
    icon: CalendarDays,
    label: "내 시간",
    value: "내 시간",
    description: "공통 시간이 먼저",
  },
  { icon: MapPin, label: "성수", value: "성수", description: "전시와 카페" },
  { icon: MapPin, label: "연남", value: "연남", description: "산책과 맛집" },
  {
    icon: MapPin,
    label: "한남",
    value: "한남",
    description: "분위기 좋은 곳",
  },
  {
    icon: ImageIcon,
    label: "사진 있음",
    value: "사진 있는 사람",
    description: "검수된 사진 프로필",
  },
] as const;
const discoveryTabs = [
  "전체",
  "내 시간",
  "성수",
  "연남",
  "한남",
  "사진 있는 사람",
] as const;

function pendingReferralCode(): string {
  if (typeof window === "undefined") return "";
  const queryCode = new URLSearchParams(window.location.search).get("ref");
  if (queryCode) return queryCode;
  try {
    return window.localStorage.getItem("morrow_referral_code") || "";
  } catch {
    return "";
  }
}
const gradients = [
  "from-[#e5b7aa] via-[#bf7b70] to-[#5c3938]",
  "from-[#c2d7d1] via-[#6f9d97] to-[#304c4a]",
  "from-[#d5c5ea] via-[#997bb6] to-[#49385e]",
  "from-[#f0d5a8] via-[#c68c58] to-[#5c4130]",
];
function avatarGradient(value: string) {
  return gradients[value.charCodeAt(0) % gradients.length];
}

const ONBOARDING_DRAFT_VERSION = 1;

function onboardingDraftKey(codersId: string) {
  return `morrow_onboarding_draft_v${ONBOARDING_DRAFT_VERSION}:${codersId}`;
}

function readOnboardingDraft(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeOnboardingDraft(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be disabled or full; the server remains the source of truth.
  }
}

function clearOnboardingDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // A failed cleanup must not turn a successful profile save into an error.
  }
}

function restoreOnboardingDraft(
  raw: string,
  fallback: ProfileInput,
): { form: ProfileInput; step: number } | null {
  try {
    const parsed = JSON.parse(raw) as {
      version?: unknown;
      form?: Record<string, unknown>;
      step?: unknown;
    };
    if (parsed.version !== ONBOARDING_DRAFT_VERSION) return null;
    if (!parsed.form || typeof parsed.form !== "object") return null;
    const draft = parsed.form;
    const next = { ...fallback };
    const textFields = ["display_name", "job", "bio", "date_style"] as const;
    for (const field of textFields) {
      if (typeof draft[field] === "string") {
        next[field] = draft[field].trim().slice(0, field === "bio" ? 240 : field === "job" ? 48 : field === "date_style" ? 32 : 20);
      }
    }
    if (typeof draft.age === "number" && Number.isFinite(draft.age))
      next.age = Math.max(20, Math.min(49, Math.round(draft.age)));
    if (typeof draft.min_preferred_age === "number" && Number.isFinite(draft.min_preferred_age))
      next.min_preferred_age = Math.max(20, Math.min(49, Math.round(draft.min_preferred_age)));
    if (typeof draft.max_preferred_age === "number" && Number.isFinite(draft.max_preferred_age))
      next.max_preferred_age = Math.max(20, Math.min(49, Math.round(draft.max_preferred_age)));
    if (typeof draft.max_distance_km === "number" && DISTANCE_OPTIONS.some((distance) => distance === draft.max_distance_km))
      next.max_distance_km = draft.max_distance_km;
    if ((areas as readonly string[]).includes(String(draft.area))) next.area = String(draft.area);
    if (["woman", "man", "other"].includes(String(draft.gender)))
      next.gender = draft.gender as ProfileInput["gender"];
    if (["woman", "man", "all"].includes(String(draft.seeking)))
      next.seeking = draft.seeking as ProfileInput["seeking"];
    if (Array.isArray(draft.interests))
      next.interests = draft.interests
        .filter((item): item is string => typeof item === "string" && interests.includes(item))
        .slice(0, 6);
    if (Array.isArray(draft.availability))
      next.availability = draft.availability
        .filter((item): item is string => typeof item === "string" && times.includes(item))
        .slice(0, 4);
    if (typeof draft.referral_code === "string")
      next.referral_code = draft.referral_code.trim().toUpperCase().slice(0, 12);
    for (const field of [
      "terms_agreed",
      "privacy_agreed",
      "adult_confirmed",
      "marketing_opt_in",
    ] as const) {
      if (typeof draft[field] === "boolean") next[field] = draft[field];
    }
    const step = typeof parsed.step === "number" && parsed.step >= 1 && parsed.step <= 5 ? Math.round(parsed.step) : 1;
    return { form: next, step };
  } catch {
    return null;
  }
}

export function MorrowDashboard({ me }: { me: Me }) {
  const [tab, setTab] = useState<Tab>("discover");
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [matchedName, setMatchedName] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchItem | null>(null);
  const [selectedMatchView, setSelectedMatchView] = useState<DrawerView>("chat");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [savedProfiles, setSavedProfiles] = useState<DiscoverProfile[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [receivedInterests, setReceivedInterests] = useState<ReceivedInterest[]>([]);
  const [receivedLoading, setReceivedLoading] = useState(false);
  const [receivedHasMore, setReceivedHasMore] = useState(false);
  const [selectedInterest, setSelectedInterest] = useState<ReceivedInterest | null>(null);
  const [filters, setFilters] = useState<DiscoverFilters>({});
  const [hasMoreProfiles, setHasMoreProfiles] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [feedTab, setFeedTab] = useState("전체");
  const discoverAbortRef = useRef<AbortController | null>(null);
  const savedBusyRef = useRef(new Set<string>());
  const current = profiles[0];

  const loadProfiles = useCallback(async () => {
    if (!me.profile_complete || !me.legal_complete || me.status !== "active")
      return;
    discoverAbortRef.current?.abort();
    const controller = new AbortController();
    discoverAbortRef.current = controller;
    setLoading(true);
    try {
      const result = await fetchDiscover(filters, controller.signal);
      setProfiles(result.items);
      setHasMoreProfiles(result.has_more);
    } catch (error) {
      if (controller.signal.aborted) return;
      setNotice(
        error instanceof Error ? error.message : "추천을 불러오지 못했어요",
      );
    } finally {
      if (discoverAbortRef.current === controller) {
        discoverAbortRef.current = null;
        setLoading(false);
      }
    }
  }, [filters, me.legal_complete, me.profile_complete, me.status]);
  const loadMatches = useCallback(async () => {
    if (!me.profile_complete || !me.legal_complete || me.status !== "active")
      return;
    try {
      setMatches((await fetchMatches()).items);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "매치를 불러오지 못했어요",
      );
    }
  }, [me.legal_complete, me.profile_complete, me.status]);
  const loadNotifications = useCallback(async () => {
    if (!me.profile_complete || !me.legal_complete || me.status !== "active")
      return;
    try {
      setNotifications((await fetchNotifications()).items);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "알림을 불러오지 못했어요",
      );
    } finally {
      setNotificationsLoading(false);
    }
  }, [me.legal_complete, me.profile_complete, me.status]);
  const loadSavedProfiles = useCallback(async () => {
    if (!me.profile_complete || !me.legal_complete || me.status !== "active")
      return;
    setSavedLoading(true);
    try {
      setSavedProfiles((await fetchSavedProfiles()).items);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "저장한 프로필을 불러오지 못했어요",
      );
    } finally {
      setSavedLoading(false);
    }
  }, [me.legal_complete, me.profile_complete, me.status]);
  const loadReceivedInterests = useCallback(async () => {
    if (!me.profile_complete || !me.legal_complete || me.status !== "active")
      return;
    setReceivedLoading(true);
    try {
      const result = await fetchReceivedInterests();
      setReceivedInterests(result.items);
      setReceivedHasMore(result.has_more);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "받은 관심을 불러오지 못했어요",
      );
    } finally {
      setReceivedLoading(false);
    }
  }, [me.legal_complete, me.profile_complete, me.status]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([
        loadProfiles(),
        loadMatches(),
        loadNotifications(),
        loadReceivedInterests(),
      ]);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      discoverAbortRef.current?.abort();
    };
  }, [loadMatches, loadNotifications, loadProfiles, loadReceivedInterests]);

  useEffect(() => {
    if (!me.profile_complete || !me.legal_complete || me.status !== "active")
      return;
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;
    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(inboxSocketUrl());
      socket.onopen = () => {
        attempts = 0;
        heartbeatTimer = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN)
            socket.send(JSON.stringify({ type: "ping" }));
        }, 25_000);
      };
      socket.onmessage = (event) => {
        let payload: RealtimeEvent;
        try {
          payload = JSON.parse(event.data) as RealtimeEvent;
        } catch {
          return;
        }
        if (payload.type === "interest_created") {
          void loadReceivedInterests();
          return;
        }
        if (payload.type !== "notification") return;
        setNotifications((current) =>
          [
            payload.item,
            ...current.filter((item) => item.id !== payload.item.id),
          ].slice(0, 50),
        );
        if (payload.item.action_type === "match") loadMatches();
      };
      socket.onclose = () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (disposed) return;
        const delay = Math.min(1_000 * 2 ** attempts, 15_000);
        attempts += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
      socket.onerror = () => socket?.close();
    };
    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      socket?.close(1000, "dashboard closed");
    };
  }, [loadMatches, loadReceivedInterests, me.legal_complete, me.profile_complete, me.status]);

  async function decideProfile(
    target: DiscoverProfile,
    decision: "like" | "pass",
  ) {
    if (loading) return;
    const remaining = profiles.filter((item) => item.id !== target.id);
    setProfiles(remaining);
    // The API marks displayed profiles as seen and can return another page.
    // Pull that page immediately when the current queue is exhausted so users
    // never have to discover the refresh button to keep browsing.
    if (remaining.length === 0 && hasMoreProfiles) {
      window.setTimeout(() => void loadProfiles(), 0);
    }
    try {
      const result = await sendSwipe(target.id, decision);
      if (result.matched) {
        setMatchedName(result.person || target.display_name);
        loadMatches();
      } else if (decision === "like")
        setNotice(`${target.display_name}님에게 관심을 보냈어요`);
    } catch (error) {
      setProfiles((items) => [target, ...items]);
      setNotice(error instanceof Error ? error.message : "다시 시도해주세요");
    }
  }

  async function decide(decision: "like" | "pass") {
    if (current) await decideProfile(current, decision);
  }

  async function respondToInterest(
    profile: ReceivedInterest,
    decision: "like" | "pass",
  ) {
    const previous = receivedInterests;
    setReceivedInterests((items) => items.filter((item) => item.id !== profile.id));
    setSelectedInterest(null);
    try {
      const result = await sendSwipe(profile.id, decision);
      if (result.matched) {
        setMatchedName(result.person || profile.display_name);
        void Promise.all([loadMatches(), loadReceivedInterests()]);
      } else if (decision === "like") {
        setNotice(`${profile.display_name}님에게 관심을 보냈어요`);
      }
    } catch (error) {
      setReceivedInterests(previous);
      setNotice(error instanceof Error ? error.message : "다시 시도해주세요");
    }
  }

  async function toggleSavedProfile(profile: DiscoverProfile) {
    if (savedBusyRef.current.has(profile.id)) return;
    savedBusyRef.current.add(profile.id);
    const nextSaved = profile.saved !== true;
    const previousProfiles = profiles;
    const previousSavedProfiles = savedProfiles;
    const previousReceivedInterests = receivedInterests;
    const withSavedState = { ...profile, saved: nextSaved };
    setProfiles((items) =>
      items.map((item) => (item.id === profile.id ? withSavedState : item)),
    );
    setSavedProfiles((items) =>
      nextSaved
        ? [
            withSavedState,
            ...items.filter((item) => item.id !== profile.id),
          ]
        : items.filter((item) => item.id !== profile.id),
    );
    setReceivedInterests((items) =>
      items.map((item) => (item.id === profile.id ? { ...item, saved: nextSaved } : item)),
    );
    try {
      if (nextSaved) await saveProfileForLater(profile.id);
      else await removeSavedProfile(profile.id);
      setNotice(
        nextSaved
          ? "나중에 다시 볼 프로필에 저장했어요"
          : "저장한 프로필에서 삭제했어요",
      );
    } catch (error) {
      setProfiles(previousProfiles);
      setSavedProfiles(previousSavedProfiles);
      setReceivedInterests(previousReceivedInterests);
      setNotice(error instanceof Error ? error.message : "저장 상태를 바꾸지 못했어요");
    } finally {
      savedBusyRef.current.delete(profile.id);
    }
  }

  function selectFeedTab(tab: string) {
    setFeedTab(tab);
    if (tab === "전체") setFilters({});
    else if (tab === "내 시간")
      setFilters({ availability: me.availability[0] });
    else if (tab === "사진 있는 사람") setFilters({ photo_only: true });
    else setFilters({ area: tab });
  }

  async function selectNotification(item: NotificationItem) {
    if (!item.read_at) {
      setNotifications((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, read_at: new Date().toISOString() }
            : entry,
        ),
      );
      readNotification(item.id).catch(() => undefined);
    }
    if (item.action_type === "match" && item.action_id) {
      const found = matches.find((match) => match.id === item.action_id);
      setTab("matches");
      if (found) {
        setSelectedMatchView("chat");
        setSelectedMatch(found);
      }
    }
  }

  async function markAllNotificationsRead() {
    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        read_at: item.read_at || new Date().toISOString(),
      })),
    );
    try {
      await readAllNotifications();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "알림을 처리하지 못했어요",
      );
    }
  }

  if (me.status !== "active") return <RestrictedAccount me={me} />;
  if (!me.profile_complete) return <Onboarding me={me} />;
  if (!me.legal_complete) return <ConsentGate />;

  const unreadNotifications = notifications.filter(
    (item) => !item.read_at,
  ).length;

  return (
    <main className="morrow-dashboard min-h-screen bg-[#fffdfb] text-[#21191b]">
      <header className="sticky top-0 z-40 bg-[#fffdfb]/95 backdrop-blur-xl">
        <div className="bg-[#fff0f2] px-4 py-1.5 text-center text-[10px] font-semibold text-[#8f2940] sm:text-[11px]">
          실제 회원과 연결돼요 · 이번 주 가능한 시간부터 맞춰보세요
        </div>
        <div className="border-b border-[#eee7e5]">
          <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-5 px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setTab("discover")}
              className="shrink-0 text-[21px] font-black tracking-[-.055em]"
              aria-label="추천 홈"
            >
              MORROW
            </button>
            <button
              onClick={() => {
                setTab("discover");
                setFilterOpen(true);
              }}
              className="hidden h-10 w-full max-w-[280px] items-center gap-2 rounded-full bg-[#f8f3f1] px-4 text-left text-sm font-medium text-[#806f72] lg:flex"
            >
              <Search className="size-4" />
              동네·취향·시간 검색
            </button>
            <nav className="ml-auto hidden items-center gap-1 md:flex">
              <NavButton
                active={tab === "discover"}
                onClick={() => setTab("discover")}
                icon={Sparkles}
              >
                오늘의 추천
              </NavButton>
              <NavButton
                active={tab === "matches"}
                onClick={() => setTab("matches")}
                icon={MessageCircle}
              >
                매치
              </NavButton>
              <NavButton
                active={tab === "saved"}
                onClick={() => {
                  setTab("saved");
                  void loadSavedProfiles();
                }}
                icon={Bookmark}
              >
                저장
              </NavButton>
              <span className="relative">
                <NavButton
                  active={tab === "activity"}
                  onClick={() => setTab("activity")}
                  icon={Bell}
                >
                  알림
                </NavButton>
                {unreadNotifications > 0 ? (
                  <span className="pointer-events-none absolute right-1 top-0 grid min-w-4 place-items-center rounded-full bg-[#ff385c] px-1 py-0.5 text-[9px] font-black text-white">
                    {Math.min(unreadNotifications, 99)}
                  </span>
                ) : null}
              </span>
              <NavButton
                active={tab === "profile"}
                onClick={() => setTab("profile")}
                icon={UserRound}
              >
                내 프로필
              </NavButton>
              <NavButton
                active={tab === "safety"}
                onClick={() => setTab("safety")}
                icon={ShieldCheck}
              >
                안전
              </NavButton>
            </nav>
            <button
              onClick={() => setTab("profile")}
              className={`relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br ${avatarGradient(me.display_name)} text-sm font-black text-white`}
              aria-label="내 프로필"
            >
              {me.photos[0] ? (
                <Image
                  src={me.photos[0].url}
                  alt=""
                  fill
                  unoptimized
                  sizes="36px"
                  className="object-cover"
                />
              ) : (
                me.display_name.slice(0, 1)
              )}
            </button>
          </div>
        </div>
      </header>
      {notice && (
        <button
          className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-[#211c1a] px-5 py-3 text-sm font-bold text-white shadow-xl"
          onClick={() => setNotice(null)}
        >
          {notice}
        </button>
      )}
      <div className="mx-auto max-w-[1280px] px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        {(tab === "discover" || tab === "matches") && (
          <MorrowPulse
            profiles={profiles}
            matches={matches}
            receivedCount={receivedInterests.length}
            onDiscover={() => {
              setTab("discover");
              void loadProfiles();
            }}
            onOpenInterests={() => setTab("matches")}
            onOpenMatch={(match, view) => {
              setSelectedMatchView(view);
              setSelectedMatch(match);
            }}
          />
        )}
        {tab === "discover" && (
          <DiscoverFeed
            profiles={profiles}
            loading={loading}
            filters={filters}
            feedTab={feedTab}
            onSelectTab={selectFeedTab}
            onRefresh={loadProfiles}
            onFilter={() => setFilterOpen((open) => !open)}
            onCloseFilter={() => setFilterOpen(false)}
            filterOpen={filterOpen}
            onFilterChange={(next) => {
              setFilters(next);
              setFilterOpen(false);
            }}
            onLike={(profile) => decideProfile(profile, "like")}
            onPass={(profile) => decideProfile(profile, "pass")}
            savedCount={savedProfiles.length}
            onSaved={() => {
              setTab("saved");
              void loadSavedProfiles();
            }}
            onSave={(profile) => void toggleSavedProfile(profile)}
            onSafety={(profile) =>
              setProfiles((items) =>
                items.filter((item) => item.id !== profile.id),
              )
            }
          />
        )}
        {tab === "saved" && (
          <SavedProfilesView
            profiles={savedProfiles}
            loading={savedLoading}
            onBack={() => setTab("discover")}
            onOpenDiscover={() => {
              setTab("discover");
              void loadProfiles();
            }}
            onLike={(profile) => decideProfile(profile, "like")}
            onPass={(profile) => decideProfile(profile, "pass")}
            onSave={(profile) => void toggleSavedProfile(profile)}
            onSafety={(profile) =>
              setSavedProfiles((items) =>
                items.filter((item) => item.id !== profile.id),
              )
            }
          />
        )}
        {false && tab === "discover" && (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black text-[#ff5d68]">
                      TODAY&apos;S CONNECTION
                    </p>
                    <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black text-[#8d7c78]">
                      PHOTO + MOOD
                    </span>
                    {Object.keys(filters).length > 0 && (
                      <span className="rounded-full bg-[#2d2327] px-2.5 py-1 text-[10px] font-black text-white">
                        필터 적용
                      </span>
                    )}
                  </div>
                  <h1 className="mt-1 text-2xl font-black tracking-[-.04em] sm:text-3xl">
                    이번 주의 큐레이션
                  </h1>
                  <p className="mt-2 text-sm font-medium text-[#8d807a]">
                    시간이 맞는 사람부터, 약속이 될 가능성까지 함께 봤어요.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilterOpen((open) => !open)}
                    className={`grid size-10 place-items-center rounded-full border shadow-sm transition ${filterOpen || Object.keys(filters).length > 0 ? "border-[#ffb5b9] bg-[#fff0ed] text-[#e95760]" : "border-[#e7dfdb] bg-white text-[#756a65]"}`}
                    aria-label="추천 필터"
                  >
                    <SlidersHorizontal className="size-4" />
                  </button>
                  <button
                    onClick={loadProfiles}
                    className="grid size-10 place-items-center rounded-full border border-[#e7dfdb] bg-white text-[#756a65] shadow-sm transition hover:-rotate-12"
                    aria-label="추천 새로고침"
                  >
                    <RefreshCw
                      className={`size-4 ${loading ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>
              </div>
              {filterOpen && (
                <FilterSheet
                  value={filters}
                  onChange={setFilters}
                  onClose={() => setFilterOpen(false)}
                />
              )}
              {current ? (
                <ProfileCard
                  profile={current}
                  onPass={() => decide("pass")}
                  onLike={() => decide("like")}
                />
              ) : (
                <EmptyDiscover loading={loading} onRetry={loadProfiles} />
              )}
            </div>
            <aside className="space-y-4">
              <section className="morrow-card-lift rounded-[26px] border border-[#ebe3df] bg-white/90 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black tracking-[.16em] text-[#a0928c]">
                      MY WEEK
                    </p>
                    <h2 className="mt-1 font-black">이번 주 내 일정</h2>
                  </div>
                  <span className="grid size-10 place-items-center rounded-2xl bg-[#fff0ed] text-[#ff5d68]">
                    <CalendarDays className="size-5" />
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  {me.availability.map((time, index) => (
                    <div key={time} className="flex items-center gap-3">
                      <span
                        className={`h-9 w-1 rounded-full ${index === 0 ? "bg-gradient-to-b from-[#ff5d68] to-[#ff9b8d]" : "bg-[#eaded9]"}`}
                      />
                      <div>
                        <p className="text-xs font-semibold text-[#9a8e88]">
                          {index === 0 ? "가장 선호" : "가능"}
                        </p>
                        <p className="text-sm font-black">{time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="overflow-hidden rounded-[26px] bg-gradient-to-br from-[#2d2327] via-[#3c2b3a] to-[#251f32] p-6 text-white shadow-[0_20px_45px_rgba(48,30,46,.18)]">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-2xl bg-white/10">
                    <ShieldCheck className="size-5 text-[#ff9ca3]" />
                  </span>
                  <span className="text-[10px] font-black tracking-[.16em] text-white/45">
                    SAFETY FIRST
                  </span>
                </div>
                <h2 className="mt-5 text-lg font-black">
                  첫 약속은 공개된 장소에서
                </h2>
                <p className="mt-2 text-sm font-medium leading-6 text-white/60">
                  연락처를 바로 공유하지 말고, 앱 안에서 충분히 대화한 뒤
                  만나세요.
                </p>
                <button
                  onClick={() => setTab("safety")}
                  className="mt-5 flex items-center gap-1 text-sm font-bold text-[#ffb2b7]"
                >
                  안전 가이드 보기 <ChevronRight className="size-4" />
                </button>
              </section>
            </aside>
          </section>
        )}
        {tab === "matches" && (
          <section>
            <div className="mb-6">
              <p className="text-sm font-black text-[#ff5d68]">CONNECTIONS</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-.04em]">
                이어진 사이
              </h1>
              <p className="mt-2 text-sm font-medium text-[#8d807a]">
                가벼운 인사부터 오늘의 약속까지.
              </p>
            </div>
            <ReceivedInterestSection
              items={receivedInterests}
              loading={receivedLoading}
              hasMore={receivedHasMore}
              onRefresh={() => void loadReceivedInterests()}
              onOpen={(profile) => setSelectedInterest(profile)}
              onLike={(profile) => respondToInterest(profile, "like")}
              onPass={(profile) => respondToInterest(profile, "pass")}
            />
            {matches.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {matches.map((match) => (
                  <button
                    key={match.id}
                    type="button"
                    onClick={() => {
                      setSelectedMatchView(getMatchNextView(match));
                      setSelectedMatch(match);
                    }}
                    className="morrow-card-lift flex items-center gap-4 rounded-[20px] border border-[#eee5e3] bg-white p-4 text-left shadow-[0_10px_30px_rgba(72,45,52,.04)]"
                  >
                    <span
                      className={`relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br ${avatarGradient(match.person.display_name)} text-xl font-black text-white`}
                    >
                      {match.person.photos?.[0] ? (
                        <Image
                          src={match.person.photos[0].url}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        match.person.display_name.slice(0, 1)
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-black">
                        {match.person.display_name}{" "}
                        <span className="text-sm font-semibold text-[#777]">
                          {match.person.age}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-sm font-medium text-[#777]">
                        {match.last_message || "먼저 인사해보세요."}
                      </span>
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#fff0f3] px-2 py-1 text-[10px] font-black text-[#d8405e]">
                        <Sparkles className="size-3" />
                        {match.unread_count > 0
                          ? "답장할 차례"
                          : match.last_message
                            ? "약속 제안하기"
                            : "3분 Sync로 시작하기"}
                      </span>
                    </span>
                    {match.unread_count > 0 ? (
                      <span className="grid min-w-6 place-items-center rounded-full bg-[#ff385c] px-1.5 py-1 text-[10px] font-black text-white">
                        {Math.min(match.unread_count, 99)}
                      </span>
                    ) : (
                      <ChevronRight className="size-4 text-[#aaa]" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-[18px] border border-dashed border-[#d7d7d7] bg-white p-12 text-center">
                <Users className="mx-auto size-8 text-[#bbb]" />
                <h2 className="mt-4 text-lg font-black">
                  아직 이어진 사이가 없어요
                </h2>
                <p className="mt-2 text-sm font-medium text-[#777]">
                  서로 관심을 보내면 여기서 대화를 시작할 수 있어요.
                </p>
                <button
                  onClick={() => setTab("discover")}
                  className="mt-5 rounded-md bg-black px-5 py-3 text-sm font-bold text-white"
                >
                  추천 보러가기
                </button>
              </div>
            )}
          </section>
        )}
        {tab === "activity" && (
          <NotificationCenter
            items={notifications}
            loading={notificationsLoading}
            onReadAll={markAllNotificationsRead}
            onSelect={selectNotification}
          />
        )}
        {tab === "profile" && <ProfilePanelV2 me={me} />}
        {tab === "safety" && <SafetyPanel />}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#eee1df] bg-[#fffdfb]/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
        <MobileNav
          active={tab === "discover"}
          onClick={() => {
            setTab("discover");
            setFilterOpen(false);
          }}
          icon={Sparkles}
        >
          홈
        </MobileNav>
        <MobileNav
          active={tab === "matches"}
          onClick={() => setTab("matches")}
          icon={MessageCircle}
        >
          매치
        </MobileNav>
        <span className="relative">
          <MobileNav
            active={tab === "activity"}
            onClick={() => setTab("activity")}
            icon={Bell}
          >
            알림
          </MobileNav>
          {unreadNotifications > 0 ? (
            <span className="pointer-events-none absolute right-[26%] top-0 grid min-w-4 place-items-center rounded-full bg-[#ff385c] px-1 text-[9px] font-black text-white">
              {Math.min(unreadNotifications, 99)}
            </span>
          ) : null}
        </span>
        <MobileNav
          active={tab === "safety"}
          onClick={() => setTab("safety")}
          icon={ShieldCheck}
        >
          안전
        </MobileNav>
        <MobileNav
          active={tab === "profile"}
          onClick={() => setTab("profile")}
          icon={UserRound}
        >
          마이
        </MobileNav>
      </nav>
      {matchedName && (
        <MatchCelebration
          name={matchedName}
          onClose={() => setMatchedName(null)}
          onChat={() => {
            setMatchedName(null);
            setTab("matches");
          }}
        />
      )}
      {selectedInterest && (
        <ProfilePreview
          profile={selectedInterest}
          onClose={() => setSelectedInterest(null)}
          onLike={() => void respondToInterest(selectedInterest, "like")}
          onPass={() => void respondToInterest(selectedInterest, "pass")}
          onSave={() => void toggleSavedProfile(selectedInterest)}
        />
      )}
      {selectedMatch && (
        <ChatDrawer
          match={selectedMatch}
          currentUserId={me.id}
          initialView={selectedMatchView}
          onClose={() => {
            setSelectedMatch(null);
            setSelectedMatchView("chat");
            loadMatches();
          }}
          onEnded={() => {
            setSelectedMatch(null);
            setSelectedMatchView("chat");
            loadMatches();
          }}
        />
      )}
    </main>
  );
}

function DiscoverFeed({
  profiles,
  loading,
  filters,
  feedTab,
  onSelectTab,
  onRefresh,
  onFilter,
  onCloseFilter,
  filterOpen,
  onFilterChange,
  onLike,
  onPass,
  onSafety,
  savedCount,
  onSaved,
  onSave,
}: {
  profiles: DiscoverProfile[];
  loading: boolean;
  filters: DiscoverFilters;
  feedTab: string;
  onSelectTab: (tab: string) => void;
  onRefresh: () => void;
  onFilter: () => void;
  onCloseFilter: () => void;
  filterOpen: boolean;
  onFilterChange: (filters: DiscoverFilters) => void;
  onLike: (profile: DiscoverProfile) => void;
  onPass: (profile: DiscoverProfile) => void;
  onSafety: (profile: DiscoverProfile) => void;
  savedCount: number;
  onSaved: () => void;
  onSave: (profile: DiscoverProfile) => void;
}) {
  const [preview, setPreview] = useState<DiscoverProfile | null>(null);
  const closePreview = useCallback(() => setPreview(null), []);
  const featured = profiles[0];
  return (
    <section className="mx-auto max-w-[1280px]">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black tracking-[.1em] text-[#ea365d]">TODAY&apos;S CONNECTION</p>
          <h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.035em] sm:text-[34px]">
            오늘, 마음이 가는 한 사람
          </h1>
          <p className="mt-2 text-sm font-medium text-[#806f72]">
            이번 주 시간과 생활권이 맞는 실제 회원부터 보여드려요.
          </p>
        </div>
        <div className="flex w-full justify-end gap-2 sm:w-auto">
          <button
            onClick={onSaved}
            className="flex min-h-11 items-center gap-2 rounded-full border border-[#e5d8d5] bg-white px-3.5 text-xs font-bold hover:border-[#21191b]"
          >
            <Bookmark className="size-3.5" />
            저장{savedCount > 0 ? ` ${savedCount}` : ""}
          </button>
          <button
            onClick={onRefresh}
            className="flex min-h-11 items-center gap-2 rounded-full border border-[#e5d8d5] bg-white px-3.5 text-xs font-bold hover:border-[#21191b]"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            새로고침
          </button>
        </div>
      </div>

      <nav className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-[#eee5e3] bg-[#eee5e3] lg:grid-cols-6">
        {discoveryCategories.map(({ icon: Icon, label, value, description }) => (
          <button
            key={value}
            onClick={() => onSelectTab(value)}
            className={`group bg-white px-3 py-4 text-center transition sm:py-5 ${feedTab === value ? "text-[#ea365d]" : "text-[#31262a] hover:bg-[#fff8f6]"}`}
          >
            <span
              className={`mx-auto grid size-9 place-items-center rounded-xl ${feedTab === value ? "bg-[#ffe6ec]" : "bg-[#f7f1ef] group-hover:bg-[#fff0f3]"}`}
            >
              <Icon className="size-4" />
            </span>
            <span className="mt-2.5 block text-sm font-bold">{label}</span>
            <span className="mt-1 hidden text-[11px] font-medium text-[#888] sm:block">
              {description}
            </span>
          </button>
        ))}
      </nav>

      <div className="mt-6 grid overflow-hidden rounded-[24px] bg-[#482731] text-white shadow-[0_18px_50px_rgba(72,39,49,.14)] lg:grid-cols-[1fr_0.82fr]">
        <article className="relative flex min-h-[260px] flex-col justify-center overflow-hidden px-6 py-10 sm:px-10 lg:px-12">
          <div aria-hidden="true" className="absolute -left-16 -top-16 size-56 rounded-full bg-[#ff6f8b]/20 blur-3xl" />
          <p className="relative text-xs font-bold tracking-[.1em] text-[#ff9db0]">
            TIME-FIRST MATCHING
          </p>
          <h2 className="relative mt-3 max-w-[520px] text-[30px] font-extrabold leading-[1.2] tracking-[-0.035em] sm:text-[38px]">
            시간이 맞는 사람은,
            <br />
            만남도 가까워지니까.
          </h2>
          <p className="relative mt-4 max-w-[480px] text-sm font-medium leading-6 text-white/70">
            무작정 좋아요를 쌓기보다 가능한 시간, 자주 가는 동네, 공통 취향을
            함께 보고 실제 약속이 될 사람을 만나보세요.
          </p>
          <div className="relative mt-6 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-2 text-xs font-bold text-[#332329]">
              이번 주 가능한 시간
            </span>
            <span className="rounded-full border border-white/25 px-3 py-2 text-xs font-bold text-white">
              공통 취향부터
            </span>
          </div>
        </article>
        <div className="relative min-h-[300px] bg-[#2a2a2a]">
          {featured?.photos[0] ? (
            <Image
              src={featured.photos[0].url}
              alt={`${featured.display_name} 추천 프로필`}
              fill
              unoptimized
              priority
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 morrow-dot-grid" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
          {featured && (
            <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-white/70">
                  실제 회원 · 오늘의 첫 번째 추천
                </p>
                <p className="mt-1 text-2xl font-extrabold">
                  {featured.display_name}{" "}
                  <span className="font-medium text-white/70">
                    {featured.age}
                  </span>
                </p>
                <p className="mt-1 text-xs font-medium text-white/70">
                  {featured.area} · {featured.job}
                </p>
              </div>
              <p className="border-b border-white pb-1 text-sm font-bold">
                {featured.compatibility}% MATCH
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="sticky top-[92px] z-30 mt-6 overflow-x-auto rounded-xl border border-[#eee5e3] bg-[#fffdfb]/95 px-2 py-2 shadow-sm backdrop-blur-xl">
        <div className="flex min-w-max items-center gap-1">
          <span className="mr-2 text-xs font-bold text-[#777]">필터</span>
          {discoveryTabs.map((tab) => {
            const value = tab;
            return (
              <button
                key={tab}
                onClick={() => onSelectTab(value)}
                className={`rounded-full px-3 py-2 text-xs font-bold transition ${feedTab === value ? "bg-[#21191b] text-white" : "text-[#66585b] hover:bg-[#f8f1ef]"}`}
              >
                {tab}
              </button>
            );
          })}
          <button
            onClick={onFilter}
            className={`ml-1 flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-bold ${filterOpen || Object.keys(filters).length > 0 ? "border-[#ff385c] text-[#ff385c]" : "border-[#dcdcdc] text-[#555]"}`}
            aria-label="세부 필터"
          >
            <SlidersHorizontal className="size-3.5" />
            상세
          </button>
        </div>
      </div>

      {filterOpen && (
        <FilterSheet
          value={filters}
          onChange={onFilterChange}
          onClose={onCloseFilter}
        />
      )}

      <div className="mt-10 flex items-end justify-between border-b-2 border-[#21191b] pb-4">
        <div>
          <p className="text-xs font-bold text-[#ea365d]">FOR YOU</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.03em] sm:text-[30px]">
            천천히 알아보고 싶은 사람들
          </h2>
        </div>
        <p className="hidden text-xs font-medium text-[#777] sm:block">
          {profiles.length}명 추천
        </p>
      </div>
      {profiles.length ? (
        <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-9 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
          {profiles.map((profile, index) => (
            <FeedProfileCard
              key={profile.id}
              profile={profile}
              rank={index + 1}
              onOpen={() => setPreview(profile)}
              onLike={() => onLike(profile)}
              onPass={() => onPass(profile)}
              onSave={() => onSave(profile)}
              onSafety={() => onSafety(profile)}
            />
          ))}
        </div>
      ) : (
        <EmptyDiscover loading={loading} onRetry={onRefresh} />
      )}
      {preview ? (
        <ProfilePreview
          profile={preview}
          onClose={closePreview}
          onLike={() => {
            onLike(preview);
            closePreview();
          }}
          onPass={() => {
            onPass(preview);
            closePreview();
          }}
          onSave={() => {
            onSave(preview);
            closePreview();
          }}
        />
      ) : null}
    </section>
  );
}

function SavedProfilesView({
  profiles,
  loading,
  onBack,
  onOpenDiscover,
  onLike,
  onPass,
  onSave,
  onSafety,
}: {
  profiles: DiscoverProfile[];
  loading: boolean;
  onBack: () => void;
  onOpenDiscover: () => void;
  onLike: (profile: DiscoverProfile) => void;
  onPass: (profile: DiscoverProfile) => void;
  onSave: (profile: DiscoverProfile) => void;
  onSafety: (profile: DiscoverProfile) => void;
}) {
  const [preview, setPreview] = useState<DiscoverProfile | null>(null);
  const closePreview = useCallback(() => setPreview(null), []);

  return (
    <section className="mx-auto max-w-[1280px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-xs font-extrabold text-[#8b7776] transition hover:text-[#21191b]"
          >
            <ArrowLeft className="size-4" /> 추천으로 돌아가기
          </button>
          <p className="text-xs font-black tracking-[.1em] text-[#ea365d]">
            YOUR SHORTLIST
          </p>
          <h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.035em] sm:text-[34px]">
            나중에 다시 볼 사람
          </h1>
          <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-[#806f72]">
            마음이 급하지 않아도 괜찮아요. 저장한 프로필은 무료로 보관되고,
            준비됐을 때 다시 대화를 시작할 수 있어요.
          </p>
        </div>
        <div className="rounded-full bg-[#fff0f3] px-3.5 py-2 text-xs font-black text-[#d9234b]">
          {profiles.length}명 저장됨
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center rounded-[24px] border border-[#eee5e3] bg-white py-20 text-sm font-bold text-[#777]">
          저장한 프로필을 불러오는 중이에요…
        </div>
      ) : profiles.length ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-9 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
          {profiles.map((profile, index) => (
            <FeedProfileCard
              key={profile.id}
              profile={profile}
              rank={index + 1}
              onOpen={() => setPreview(profile)}
              onLike={() => onLike(profile)}
              onPass={() => {
                onPass(profile);
                onSave(profile);
              }}
              onSave={() => onSave(profile)}
              onSafety={() => onSafety(profile)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-[#ddd1ce] bg-white p-12 text-center">
          <Bookmark className="mx-auto size-9 text-[#c6b5b2]" />
          <h2 className="mt-4 text-xl font-black">아직 저장한 프로필이 없어요</h2>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-[#777]">
            추천을 둘러보다가 조금 더 알아보고 싶은 사람을 저장해보세요.
            결제 없이 최대 50명까지 보관할 수 있어요.
          </p>
          <button
            type="button"
            onClick={onOpenDiscover}
            className="mt-6 min-h-11 rounded-full bg-[#21191b] px-5 text-sm font-extrabold text-white"
          >
            오늘의 추천 보기
          </button>
        </div>
      )}

      {preview ? (
        <ProfilePreview
          profile={preview}
          onClose={closePreview}
          onLike={() => {
            onLike(preview);
            closePreview();
          }}
          onPass={() => {
            onPass(preview);
            onSave(preview);
            closePreview();
          }}
          onSave={() => {
            onSave(preview);
            closePreview();
          }}
        />
      ) : null}
    </section>
  );
}

function FeedProfileCard({
  profile,
  rank,
  onOpen,
  onLike,
  onPass,
  onSave,
  onSafety,
}: {
  profile: DiscoverProfile;
  rank: number;
  onOpen: () => void;
  onLike: () => void;
  onPass: () => void;
  onSave: () => void;
  onSafety: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const photo = profile.photos[0];
  async function safety(action: "block" | "fake_profile" | "money_request") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "block") await blockUser(profile.id);
      else await reportUser(profile.id, action, "추천 프로필에서 신고됨");
      onSafety();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "처리하지 못했어요");
      setBusy(false);
    }
  }
  return (
    <article className="morrow-profile-card group min-w-0">
      <div
        className={`relative aspect-[3/4] overflow-hidden rounded-[20px] bg-gradient-to-br ${avatarGradient(profile.display_name)} shadow-[0_12px_32px_rgba(69,44,51,.10)]`}
      >
        {photo && !failed ? (
          <Image
            src={photo.url}
            alt={`${profile.display_name} 프로필`}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-[7rem] font-black text-white/25">
            {profile.display_name.slice(0, 1)}
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-[#21191b]/65 to-transparent" />
        <button
          type="button"
          onClick={onOpen}
          className="absolute inset-0 z-10 cursor-zoom-in"
          aria-label={`${profile.display_name}님 프로필 자세히 보기`}
        />
        <span className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-black text-[#302326] shadow-sm backdrop-blur-md">
          TODAY {String(rank).padStart(2, "0")}
        </span>
        <button
          onClick={() => setMenu((open) => !open)}
          className="absolute right-3 top-3 z-30 grid size-10 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur-md"
          aria-label={`${profile.display_name} 프로필 안전 메뉴`}
        >
          <MoreHorizontal className="size-4" />
        </button>
        <button
          type="button"
          onClick={onSave}
          className="absolute right-14 top-3 z-30 grid size-10 place-items-center rounded-full bg-white/90 text-[#302326] shadow-sm backdrop-blur-md transition hover:scale-105"
          aria-label={
            profile.saved
              ? `${profile.display_name}님 저장 해제`
              : `${profile.display_name}님 저장`
          }
          aria-pressed={profile.saved}
        >
          <Bookmark className={`size-4 ${profile.saved ? "fill-current" : ""}`} />
        </button>
        {menu ? (
          <div className="absolute right-2 top-12 z-40 w-40 overflow-hidden rounded-lg bg-white py-1 text-xs font-bold text-[#333] shadow-xl">
            <button
              onClick={() => safety("fake_profile")}
              className="block w-full px-3 py-2.5 text-left hover:bg-[#f5f5f5]"
            >
              사칭·허위 신고
            </button>
            <button
              onClick={() => safety("money_request")}
              className="block w-full px-3 py-2.5 text-left hover:bg-[#f5f5f5]"
            >
              금전 요구 신고
            </button>
            <button
              onClick={() => safety("block")}
              className="block w-full px-3 py-2.5 text-left text-red-600 hover:bg-red-50"
            >
              이 회원 차단
            </button>
          </div>
        ) : null}
        <span className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-[calc(100%_-_4.5rem)] truncate rounded-full border border-white/25 bg-black/25 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur-md">
          {profile.common_times[0] || profile.availability[0] || "시간 조율 가능"}
        </span>
        <button
          onClick={onLike}
          className="absolute bottom-3 right-3 z-30 grid size-10 place-items-center rounded-full bg-white text-[#ea365d] shadow-md transition hover:scale-105"
          aria-label={`${profile.display_name}님에게 관심 보내기`}
        >
          <Heart className="size-4 fill-current" />
        </button>
      </div>
      <div className="pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-extrabold tracking-[-0.015em]">
              {profile.display_name}{" "}
              <span className="font-medium text-[#777]">{profile.age}</span>
            </h3>
            <p className="mt-1 truncate text-xs font-medium text-[#777]">
              {profile.area} · {profile.job}
            </p>
            {profile.match_reasons[0] ? (
              <p className="mt-1 truncate text-[10px] font-bold text-[#ff385c]">
                {profile.match_reasons[0]}
              </p>
            ) : null}
          </div>
            <span className="shrink-0 rounded-full bg-[#fff0f3] px-2 py-1 text-[10px] font-black text-[#d92e53]">
              {profile.compatibility}% MATCH
          </span>
        </div>
        <div className="mt-3 flex min-h-5 flex-wrap gap-1.5">
          {(profile.common_interests.length
            ? profile.common_interests
            : profile.interests
          )
            .slice(0, 2)
            .map((interest) => (
              <span
                key={interest}
                className="rounded-full bg-[#f8f1ef] px-2.5 py-1 text-[10px] font-bold text-[#66585b]"
              >
                #{interest}
              </span>
            ))}
        </div>
        <button
          type="button"
          onClick={() => setWhyOpen((open) => !open)}
          aria-expanded={whyOpen}
          className="seed-action mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#fff8f6] px-2.5 text-[11px] font-bold text-[#8a5c62] hover:bg-[#fff0f3]"
        >
          <Sparkles className="size-3.5 text-[#ea365d]" />
          {whyOpen ? "추천 이유 접기" : "왜 추천됐나요?"}
          <ChevronRight className={`size-3.5 transition-transform ${whyOpen ? "rotate-90" : ""}`} />
        </button>
        {whyOpen ? (
          <div className="mt-2 rounded-xl border border-[#f0e3df] bg-[#fffaf8] p-3 text-[11px] leading-5 text-[#6f5c60]">
            <p className="font-bold text-[#4f3d42]">
              {profile.match_reasons[0] || "공통점이 있어 대화를 시작하기 좋아요."}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.common_times.slice(0, 2).map((time) => (
                <span key={time} className="seed-chip bg-[#f1f8f5] text-[#39785f]">
                  {time}
                </span>
              ))}
              {profile.common_interests.slice(0, 3).map((interest) => (
                <span key={interest} className="seed-chip bg-[#f7f1ef] text-[#66585b]">
                  #{interest}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-3 flex items-center gap-1.5 border-t border-[#eee5e3] pt-3">
          <p className="flex min-w-0 items-center gap-1.5 truncate text-[11px] font-bold text-[#333]">
            <CalendarDays className="size-3.5 shrink-0 text-[#ff385c]" />
            {profile.common_times[0] ||
              profile.availability[0] ||
              "시간 조율 가능"}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="flex h-9 items-center justify-center gap-1 rounded-xl border border-[#e5d8d5] bg-white text-[11px] font-extrabold text-[#33272a] transition hover:border-[#21191b]"
          >
            프로필 자세히 <ChevronRight className="size-3.5" />
          </button>
          <button
            onClick={onPass}
            className="h-9 shrink-0 px-2 text-[10px] font-semibold text-[#999] hover:text-black"
            aria-label={`${profile.display_name}님 패스`}
          >
            패스
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-xs font-bold text-red-600">{error}</p>
        ) : null}
      </div>
    </article>
  );
}

function ProfilePreview({
  profile,
  onClose,
  onLike,
  onPass,
  onSave,
}: {
  profile: DiscoverProfile;
  onClose: () => void;
  onLike: () => void;
  onPass: () => void;
  onSave: () => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const photo = profile.photos[photoIndex];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  function movePhoto(direction: -1 | 1) {
    if (profile.photos.length < 2) return;
    setPhotoIndex((current) =>
      (current + direction + profile.photos.length) % profile.photos.length,
    );
    setFailed(false);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 md:items-center md:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`profile-preview-${profile.id}`}
        className="relative max-h-[100dvh] w-full overflow-y-auto bg-white shadow-2xl md:max-h-[92vh] md:max-w-5xl md:rounded-xl"
      >
        <button
          type="button"
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute right-3 top-3 z-40 grid size-11 place-items-center rounded-full bg-white/95 text-[#222] shadow-lg"
          aria-label="프로필 상세 닫기"
        >
          <X className="size-5" />
        </button>
        <div className="grid lg:grid-cols-[1.05fr_.95fr]">
          <div
            className={`relative aspect-[4/5] min-h-[420px] overflow-hidden bg-gradient-to-br lg:aspect-auto lg:min-h-[760px] ${avatarGradient(profile.display_name)}`}
          >
            {photo && !failed ? (
              <Image
                src={photo.url}
                alt={`${profile.display_name} 프로필 사진 ${photoIndex + 1}`}
                fill
                unoptimized
                sizes="(max-width: 1024px) 100vw, 52vw"
                className="object-cover"
                onError={() => setFailed(true)}
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-[10rem] font-black text-white/25">
                {profile.display_name.slice(0, 1)}
              </span>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/15" />
            {profile.photos.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => movePhoto(-1)}
                  className="absolute left-3 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur"
                  aria-label="이전 사진"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => movePhoto(1)}
                  className="absolute right-3 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur"
                  aria-label="다음 사진"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            ) : null}
            <div className="absolute inset-x-5 bottom-5 z-20 text-white">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-white/70">
                    {profile.account_verified ? "본인 확인 프로필" : "가입 계정 프로필"}
                  </p>
                  <p className="mt-1 text-3xl font-extrabold tracking-[-0.035em]">
                    {profile.display_name} <span className="font-medium">{profile.age}</span>
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white/75">
                    {profile.area} · {profile.job}
                  </p>
                </div>
                {profile.photos.length > 0 ? (
                  <span className="rounded-full bg-black/35 px-3 py-1.5 text-xs font-black backdrop-blur">
                    {photoIndex + 1} / {profile.photos.length}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-col px-5 pb-5 pt-7 sm:px-8 sm:pb-8 lg:px-10 lg:pb-10 lg:pt-12">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#fff0f3] px-3 py-1.5 text-xs font-black text-[#d9234b]">
                {profile.compatibility}% MATCH
              </span>
              {profile.distance_km !== null ? (
                <span className="rounded-full bg-[#f3f3f3] px-3 py-1.5 text-xs font-black text-[#555]">
                  약 {profile.distance_km}km
                </span>
              ) : null}
              <span className="rounded-full bg-[#edf8f3] px-3 py-1.5 text-xs font-black text-[#287556]">
                <ShieldCheck className="mr-1 inline size-3.5" />
                {profile.account_verified ? "본인 확인" : "계정 확인"}
              </span>
              <button
                type="button"
                onClick={onSave}
                className="ml-auto grid min-h-11 min-w-11 place-items-center rounded-full border border-[#e1d8d5] bg-white text-[#33272a] shadow-sm transition hover:border-[#21191b]"
                aria-label={
                  profile.saved
                    ? `${profile.display_name}님 저장 해제`
                    : `${profile.display_name}님 저장`
                }
                aria-pressed={profile.saved}
              >
                <Bookmark className={`size-4 ${profile.saved ? "fill-current" : ""}`} />
              </button>
            </div>
            <h2
              id={`profile-preview-${profile.id}`}
              className="mt-6 text-2xl font-extrabold tracking-[-0.03em]"
            >
              이 사람을 더 알아보세요
            </h2>
            <p className="mt-3 text-[15px] font-medium leading-7 text-[#4f4f4f]">
              {profile.bio}
            </p>

            {profile.match_reasons.length > 0 ? (
              <div className="mt-7 rounded-xl bg-[#fff7f8] p-5">
                <p className="text-xs font-black text-[#d9234b]">추천한 이유</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.match_reasons.map((reason) => (
                    <span
                      key={reason}
                      className="rounded-md border border-[#ffd5dd] bg-white px-3 py-2 text-xs font-bold text-[#703a45]"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-7 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-black text-[#777]">함께 가능한 시간</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(profile.common_times.length
                    ? profile.common_times
                    : profile.availability.slice(0, 3)
                  ).map((time) => (
                    <span
                      key={time}
                      className="rounded-md bg-black px-3 py-2 text-xs font-bold text-white"
                    >
                      {time}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-black text-[#777]">선호하는 데이트</p>
                <p className="mt-2 text-sm font-bold leading-6 text-[#333]">
                  {profile.date_style}
                </p>
              </div>
            </div>

            <div className="mt-7">
              <p className="text-xs font-black text-[#777]">관심사</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.interests.map((interest) => {
                  const common = profile.common_interests.includes(interest);
                  return (
                    <span
                      key={interest}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${common ? "border-[#ff9bae] bg-[#fff0f3] text-[#d9234b]" : "border-[#dedede] text-[#555]"}`}
                    >
                      #{interest}{common ? " · 공통" : ""}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="sticky bottom-0 mt-9 grid grid-cols-[88px_1fr] gap-3 border-t border-[#e7e7e7] bg-white pb-[max(0px,env(safe-area-inset-bottom))] pt-4 lg:static lg:mt-auto">
              <button
                type="button"
                onClick={onPass}
                className="h-13 rounded-md border border-[#d8d8d8] text-sm font-extrabold text-[#777]"
              >
                패스
              </button>
              <button
                type="button"
                onClick={onLike}
                className="flex h-13 items-center justify-center gap-2 rounded-md bg-[#ff385c] text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(255,56,92,.24)]"
              >
                <Heart className="size-4 fill-current" /> 관심 보내기
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProfileCard({
  profile,
  onPass,
  onLike,
}: {
  profile: DiscoverProfile;
  onPass: () => void;
  onLike: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-[30px] border border-[#e9e1dd] bg-white shadow-[0_22px_70px_rgba(64,43,36,.08)]">
      <div className="grid min-h-[540px] md:grid-cols-[.86fr_1.14fr]">
        <PhotoVisual profile={profile} />
        <div className="flex flex-col p-6 sm:p-8">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-[-.04em]">
                {profile.display_name}{" "}
                <span className="font-semibold text-[#776c67]">
                  {profile.age}
                </span>
              </h2>
              <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-[#81756f]">
                <MapPin className="size-4" />
                {profile.area} · {profile.job}
              </p>
            </div>
            <button
              className="grid size-9 place-items-center rounded-full bg-[#f7f3f1] text-[#8f837d]"
              aria-label="더 보기"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </div>
          <p className="mt-7 text-lg font-bold leading-8 text-[#3e3734]">
            “{profile.bio}”
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {profile.match_reasons.map((reason) => (
              <span
                key={reason}
                className="rounded-full bg-[#f5f2ff] px-3 py-1.5 text-xs font-black text-[#7056ba]"
              >
                {reason}
              </span>
            ))}
            {profile.distance_km !== null ? (
              <span className="rounded-full bg-[#f4f4f4] px-3 py-1.5 text-xs font-black text-[#666]">
                약 {profile.distance_km}km
              </span>
            ) : null}
          </div>
          <div className="mt-7">
            <p className="text-xs font-black text-[#a0948e]">
              함께 가능한 시간
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(profile.common_times.length
                ? profile.common_times
                : profile.availability.slice(0, 2)
              ).map((item) => (
                <span
                  key={item}
                  className="rounded-xl bg-[#fff0ed] px-3 py-2 text-xs font-black text-[#d6555d]"
                >
                  <CalendarDays className="mr-1.5 inline size-3.5" />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-6">
            <p className="text-xs font-black text-[#a0948e]">관심사</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.interests.map((item) => (
                <span
                  key={item}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${profile.common_interests.includes(item) ? "border-[#ffc9cd] bg-[#fff7f5] text-[#d5565d]" : "border-[#e9e1dd] text-[#786e68]"}`}
                >
                  #{item}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-auto grid grid-cols-[72px_1fr] gap-3 pt-8">
            <button
              onClick={onPass}
              className="grid h-14 place-items-center rounded-2xl border border-[#e4dcd8] text-[#8e817b]"
              aria-label="패스"
            >
              <X className="size-6" />
            </button>
            <button
              onClick={onLike}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#ff5d68] font-black text-white shadow-[0_14px_30px_rgba(255,93,104,.25)]"
            >
              <Heart className="size-5 fill-current" /> 관심 보내기
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function PhotoVisual({ profile }: { profile: DiscoverProfile }) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const photo = profile.photos[index];
  return (
    <div
      className={`relative min-h-[350px] overflow-hidden bg-gradient-to-br ${avatarGradient(profile.display_name)}`}
    >
      {photo && !failed ? (
        <Image
          src={photo.url}
          alt={`${profile.display_name} 프로필 사진`}
          fill
          sizes="(max-width: 768px) 100vw, 480px"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-[11rem] font-black text-white/20">
          {profile.display_name.slice(0, 1)}
        </span>
      )}
      <div className="absolute inset-x-5 top-5 flex items-start justify-between gap-3">
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-black text-[#3c3633]">
          <ShieldCheck
            className={`mr-1 inline size-3.5 ${profile.account_verified ? "text-[#319f77]" : "text-[#888]"}`}
          />
          {profile.account_verified ? "본인 확인" : "가입 계정"}
        </span>
        {profile.photo_count > 0 && (
          <span className="rounded-full bg-black/35 px-3 py-1.5 text-xs font-black text-white backdrop-blur">
            사진 {index + 1}/{profile.photo_count}
          </span>
        )}
      </div>
      {profile.photos.length > 1 && (
        <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/25 px-2.5 py-1.5 backdrop-blur">
          {profile.photos.map((item, photoIndex) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setIndex(photoIndex);
                setFailed(false);
              }}
              className={`size-1.5 rounded-full ${photoIndex === index ? "bg-white" : "bg-white/45"}`}
              aria-label={`${photoIndex + 1}번 사진 보기`}
            />
          ))}
        </div>
      )}
      <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-black/30 p-4 text-white backdrop-blur-md">
        <p className="text-xs font-bold text-white/70">
          MORROW MATCH · {profile.photo_prompt}
        </p>
        <p className="mt-1 text-3xl font-black">{profile.compatibility}%</p>
        <p className="text-xs font-semibold text-white/75">
          시간과 취향을 함께 반영했어요
        </p>
      </div>
    </div>
  );
}

function EmptyDiscover({
  loading,
  onRetry,
}: {
  loading: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="grid min-h-[540px] place-items-center rounded-[30px] border border-dashed border-[#ddd2cc] bg-white p-8 text-center">
      <div>
        {loading ? (
          <RefreshCw className="mx-auto size-9 animate-spin text-[#ff5d68]" />
        ) : (
          <>
            <Sparkles className="mx-auto size-9 text-[#d1c4be]" />
            <h2 className="mt-5 text-xl font-black">
              오늘의 추천을 모두 확인했어요
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-[#8c817b]">
              새로운 프로필이 준비되면 다시 알려드릴게요.
              <br />
              MORROW는 하루에 소수만 깊게 추천해요.
            </p>
            <button
              onClick={onRetry}
              className="mt-6 rounded-xl border border-[#e4dcd8] px-5 py-3 text-sm font-black"
            >
              다시 확인
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function FilterSheet({
  value,
  onChange,
  onClose,
}: {
  value: DiscoverFilters;
  onChange: (value: DiscoverFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<DiscoverFilters>(value);
  const update = <K extends keyof DiscoverFilters>(
    key: K,
    next: DiscoverFilters[K],
  ) => setDraft((current) => ({ ...current, [key]: next }));
  function apply() {
    const next = Object.fromEntries(
      Object.entries(draft).filter(
        ([, item]) => item !== undefined && item !== "" && item !== false,
      ),
    ) as DiscoverFilters;
    onChange(next);
    onClose();
  }
  function reset() {
    setDraft({});
    onChange({});
    onClose();
  }
  return (
    <section className="morrow-glass mb-5 rounded-[24px] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-black tracking-[.14em] text-[#ff5d68]">
            <Search className="size-3.5" />
            DISCOVERY FILTER
          </p>
          <h2 className="mt-1 text-xl font-black">이번 주의 조건을 고르세요</h2>
          <p className="mt-1 text-xs font-medium text-[#8b7f79]">
            필터는 추천 순서보다 먼저 적용돼요.
          </p>
        </div>
        <button
          onClick={onClose}
          className="grid size-9 place-items-center rounded-full bg-white text-[#8b7f79]"
          aria-label="필터 닫기"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-black text-[#8b7f79]">활동 지역</p>
          <select
            value={draft.area || ""}
            onChange={(event) =>
              update("area", event.target.value || undefined)
            }
            className="morrow-input"
          >
            <option value="">어디든 좋아요</option>
            {areas.map((area) => (
              <option key={area}>{area}</option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] font-medium leading-4 text-[#9a8f8a]">
            전국을 고르면 지역 제한 없이 추천받아요.
          </p>
        </div>
        <div>
          <p className="mb-2 text-xs font-black text-[#8b7f79]">
            만나기 좋은 시간
          </p>
          <select
            value={draft.availability || ""}
            onChange={(event) =>
              update("availability", event.target.value || undefined)
            }
            className="morrow-input"
          >
            <option value="">시간은 유연해요</option>
            {times.map((time) => (
              <option key={time}>{time}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-2 text-xs font-black text-[#8b7f79]">나이 범위</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={20}
              max={39}
              value={draft.min_age || ""}
              onChange={(event) =>
                update(
                  "min_age",
                  event.target.value ? Number(event.target.value) : undefined,
                )
              }
              placeholder="최소"
              className="morrow-input"
            />
            <input
              type="number"
              min={20}
              max={39}
              value={draft.max_age || ""}
              onChange={(event) =>
                update(
                  "max_age",
                  event.target.value ? Number(event.target.value) : undefined,
                )
              }
              placeholder="최대"
              className="morrow-input"
            />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-black text-[#8b7f79]">공통 관심사</p>
          <select
            value={draft.interest || ""}
            onChange={(event) =>
              update("interest", event.target.value || undefined)
            }
            className="morrow-input"
          >
            <option value="">취향은 열어둘게요</option>
            {interests.map((interest) => (
              <option key={interest}>{interest}</option>
            ))}
          </select>
        </div>
      </div>
      <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl bg-white/80 p-4">
        <input
          type="checkbox"
          checked={Boolean(draft.photo_only)}
          onChange={(event) =>
            update("photo_only", event.target.checked || undefined)
          }
          className="size-4 accent-[#ff5d68]"
        />
        <span className="grid size-9 place-items-center rounded-xl bg-[#fff0ed] text-[#ff5d68]">
          <ImageIcon className="size-4" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-black">사진이 있는 프로필만</span>
          <span className="mt-0.5 block text-xs font-medium text-[#958781]">
            사진과 분위기를 먼저 확인하고 싶을 때
          </span>
        </span>
      </label>
      <div className="mt-5 flex gap-2">
        <button
          onClick={reset}
          className="h-11 rounded-xl border border-[#e5dcd7] px-4 text-sm font-black text-[#8b7f79]"
        >
          초기화
        </button>
        <button
          onClick={apply}
          className="h-11 flex-1 rounded-xl bg-[#ff5d68] text-sm font-black text-white shadow-[0_10px_22px_rgba(255,93,104,.2)]"
        >
          이 조건으로 추천받기
        </button>
      </div>
    </section>
  );
}

function RestrictedAccount({ me }: { me: Me }) {
  const until = me.suspended_until
    ? new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date(me.suspended_until))
    : null;
  return (
    <main className="min-h-screen bg-[#f5f5f3] px-4 py-10 text-[#111]">
      <div className="mx-auto max-w-2xl">
        <section className="rounded-xl border border-[#e2e2e2] bg-white p-7 sm:p-10">
          <span className="grid size-12 place-items-center rounded-lg bg-red-50 text-red-600">
            <ShieldCheck className="size-6" />
          </span>
          <p className="mt-6 text-xs font-black text-red-600">ACCOUNT NOTICE</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-.04em]">
            계정 이용이 제한되어 있어요.
          </h1>
          <p className="mt-3 text-sm font-medium leading-6 text-[#666]">
            안전 운영 기준에 따라 추천, 매치와 대화 기능이 중단됐습니다.
            {until
              ? ` 제한 종료 예정은 ${until}입니다.`
              : " 영구 제한 상태입니다."}
          </p>
          <div className="mt-6 flex gap-3">
            <a
              href="/community-guidelines"
              className="rounded-md border border-[#ccc] px-4 py-3 text-sm font-black"
            >
              운영 기준 보기
            </a>
            <span className="rounded-md bg-black px-4 py-3 text-sm font-black text-white">
              <SignOutLink returnTo="/" />
            </span>
          </div>
        </section>
        <AccountCenter isAdmin={false} />
      </div>
    </main>
  );
}

function defaultOnboardingForm(me: Me): ProfileInput {
  return {
    display_name: me.display_name.startsWith("user-") ? "" : me.display_name,
    age: 25,
    gender: "woman",
    seeking: "man",
    area: "전국",
    job: "",
    bio: "",
    date_style: "대화가 잘 통하는 편안한 데이트",
    interests: [],
    availability: [],
    min_preferred_age: 20,
    max_preferred_age: 39,
    max_distance_km: 30,
    referral_code: pendingReferralCode(),
    terms_agreed: false,
    privacy_agreed: false,
    adult_confirmed: false,
    marketing_opt_in: false,
  };
}

function Onboarding({ me }: { me: Me }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<ProfilePhoto[]>(me.photos);
  const [form, setForm] = useState<ProfileInput>(() => defaultOnboardingForm(me));
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const draftKey = onboardingDraftKey(me.coders_id);

  useEffect(() => {
    let disposed = false;
    const timer = window.setTimeout(() => {
      const raw = readOnboardingDraft(draftKey);
      const restored = raw
        ? restoreOnboardingDraft(raw, defaultOnboardingForm(me))
        : null;
      if (disposed) return;
      if (restored) {
        setForm(restored.form);
        setStep(restored.step);
        setDraftRestored(true);
      }
      setDraftReady(true);
    }, 0);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [draftKey, me]);

  useEffect(() => {
    if (!draftReady) return;
    writeOnboardingDraft(
      draftKey,
      JSON.stringify({ version: ONBOARDING_DRAFT_VERSION, step, form }),
    );
  }, [draftKey, draftReady, form, step]);
  const toggle = (
    key: "interests" | "availability",
    value: string,
    max: number,
  ) =>
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : current[key].length < max
          ? [...current[key], value]
          : current[key],
    }));
  const canNext =
    step === 1
      ? !!form.display_name && !!form.job && form.min_preferred_age <= form.max_preferred_age
      : step === 2
        ? form.bio.length >= 10 && form.date_style.trim().length > 0 && form.interests.length >= 3
        : step === 3
          ? form.availability.length > 0
          : step === 4
            ? true
            : form.terms_agreed && form.privacy_agreed && form.adult_confirmed;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step < 5) {
      setStep(step + 1);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveProfile(form);
      clearOnboardingDraft("morrow_referral_code");
      clearOnboardingDraft(draftKey);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "프로필을 저장하지 못했어요");
      setSaving(false);
    }
  }

  return (
    <main className="morrow-dashboard min-h-screen px-4 py-6 text-[#211c1a] sm:py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-lg font-black">
            <span className="grid size-9 place-items-center rounded-[13px] bg-gradient-to-br from-[#ff5d68] to-[#956eff] text-white shadow-[0_8px_20px_rgba(255,93,104,.22)]">
              <Heart className="size-4 fill-current" />
            </span>
            MORROW
          </span>
          <span className="rounded-full bg-white/70 px-3 py-1 text-sm font-black text-[#9a8f89]">
            {step} / 5
          </span>
        </div>
        <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-white/70">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#ff5d68] to-[#956eff] transition-all"
            style={{ width: `${step * 20}%` }}
          />
        </div>
        {draftRestored ? (
          <p
            role="status"
            className="mt-3 text-center text-xs font-bold text-[#7f736d]"
          >
            이전에 입력하던 내용을 불러왔어요. 이 기기에 자동 저장됩니다.
          </p>
        ) : null}
        <form
          onSubmit={submit}
          className="morrow-glass mt-8 rounded-[28px] p-6 sm:p-9"
        >
          {step === 1 && (
            <div>
              <p className="text-sm font-black text-[#ff5d68]">BASIC</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-.04em]">
                어떻게 불러드릴까요?
              </h1>
              <p className="mt-2 text-sm font-medium text-[#8b7f79]">
                상대에게 실제로 표시할 정보를 직접 입력해주세요.
              </p>
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <Field label="이름">
                  <input
                    required
                    maxLength={20}
                    value={form.display_name}
                    onChange={(e) =>
                      setForm({ ...form, display_name: e.target.value })
                    }
                    placeholder="표시할 이름 입력"
                    className="morrow-input"
                  />
                </Field>
                <Field label="나이">
                  <input
                    required
                    type="number"
                    min={20}
                    max={49}
                    value={form.age}
                    onChange={(e) =>
                      setForm({ ...form, age: Number(e.target.value) })
                    }
                    className="morrow-input"
                  />
                </Field>
                <Field label="나는">
                  <select
                    value={form.gender}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        gender: e.target.value as ProfileInput["gender"],
                      })
                    }
                    className="morrow-input"
                  >
                    <option value="woman">여성</option>
                    <option value="man">남성</option>
                    <option value="other">기타</option>
                  </select>
                </Field>
                <Field label="만나고 싶은 사람">
                  <select
                    value={form.seeking}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        seeking: e.target.value as ProfileInput["seeking"],
                      })
                    }
                    className="morrow-input"
                  >
                    <option value="man">남성</option>
                    <option value="woman">여성</option>
                    <option value="all">모두</option>
                  </select>
                </Field>
                <Field label="주 활동 지역">
                  <select
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    className="morrow-input"
                  >
                    {areas.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[11px] font-medium leading-4 text-[#9a8f8a]">
                    전국을 선택하면 주소를 저장하지 않고 전국 회원을 탐색해요.
                  </p>
                </Field>
                <Field label="하는 일">
                  <input
                    required
                    maxLength={48}
                    value={form.job}
                    onChange={(e) => setForm({ ...form, job: e.target.value })}
                    placeholder="직업 또는 활동 입력"
                    className="morrow-input"
                  />
                </Field>
                <Field label="선호 나이">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <input
                      required
                      type="number"
                      min={20}
                      max={49}
                      value={form.min_preferred_age}
                      onChange={(e) => setForm({ ...form, min_preferred_age: Number(e.target.value) })}
                      className="morrow-input"
                      aria-label="선호 최소 나이"
                    />
                    <span className="text-xs font-black text-[#999]">~</span>
                    <input
                      required
                      type="number"
                      min={20}
                      max={49}
                      value={form.max_preferred_age}
                      onChange={(e) => setForm({ ...form, max_preferred_age: Number(e.target.value) })}
                      className="morrow-input"
                      aria-label="선호 최대 나이"
                    />
                  </div>
                </Field>
                <Field label="추천 거리">
                  <select
                    value={form.max_distance_km}
                    onChange={(e) => setForm({ ...form, max_distance_km: Number(e.target.value) })}
                    className="morrow-input"
                  >
                    {DISTANCE_OPTIONS.map((distance) => (
                      <option key={distance} value={distance}>{distance}km 이내</option>
                    ))}
                  </select>
                </Field>
                <Field label="초대 코드 (선택)">
                  <input
                    maxLength={12}
                    value={form.referral_code || ""}
                    onChange={(e) => setForm({ ...form, referral_code: e.target.value.toUpperCase() })}
                    placeholder="친구에게 받은 코드"
                    className="morrow-input uppercase"
                  />
                </Field>
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <p className="text-sm font-black text-[#ff5d68]">MOOD</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-.04em]">
                당신의 분위기를 알려주세요
              </h1>
              <Field label="짧은 소개">
                <textarea
                  required
                  minLength={10}
                  maxLength={240}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="주말엔 전시를 보거나 새로운 동네를 걷는 걸 좋아해요."
                  className="morrow-input mt-3 min-h-28 resize-none"
                />
              </Field>
              <Field label="선호하는 데이트">
                <input
                  required
                  maxLength={32}
                  value={form.date_style}
                  onChange={(e) =>
                    setForm({ ...form, date_style: e.target.value })
                  }
                  placeholder="예: 대화가 잘 통하는 편안한 데이트"
                  className="morrow-input mt-3"
                />
              </Field>
              <div className="mt-7">
                <p className="text-sm font-black">
                  관심사{" "}
                  <span className="font-semibold text-[#a0948e]">3~6개</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {interests.map((item) => (
                    <Choice
                      key={item}
                      active={form.interests.includes(item)}
                      onClick={() => toggle("interests", item, 6)}
                    >
                      #{item}
                    </Choice>
                  ))}
                </div>
              </div>
            </div>
          )}
          {step === 3 && (
            <div>
              <p className="text-sm font-black text-[#ff5d68]">AVAILABILITY</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-.04em]">
                언제 만날 수 있나요?
              </h1>
              <p className="mt-2 text-sm font-medium text-[#8b7f79]">
                실제로 시간이 맞는 사람부터 추천해드려요. 선택한 시간은 추천 순서에
                가장 먼저 반영됩니다.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {times.map((time) => (
                  <Choice
                    key={time}
                    active={form.availability.includes(time)}
                    onClick={() => toggle("availability", time, 4)}
                    wide
                  >
                    <CalendarDays className="size-4" />
                    {time}
                  </Choice>
                ))}
              </div>
              <div className="mt-7 rounded-2xl bg-[#fff4f1] p-5">
                <p className="text-sm font-black text-[#d95860]">
                  개인정보는 필요한 만큼만
                </p>
                <p className="mt-1 text-xs font-medium leading-5 text-[#8d706d]">
                  정확한 위치나 연락처는 공개하지 않습니다. 활동 지역만 상대에게
                  보여요.
                </p>
              </div>
            </div>
          )}
          {step === 4 && (
            <div>
              <p className="text-sm font-black text-[#ff5d68]">PROFILE PHOTO</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-.04em]">
                사진으로 분위기를 보여줄까요?
              </h1>
              <p className="mt-2 text-sm font-medium leading-6 text-[#8b7f79]">
                사진은 선택사항이에요. 등록한 사진은 검수 후에만 다른 회원에게
                공개되고, 나중에 내 프로필에서 언제든 추가·정리할 수 있어요.
              </p>
              <ProfilePhotos
                initialPhotos={photos}
                onPhotosChange={setPhotos}
              />
            </div>
          )}
          {step === 5 && (
            <div>
              <p className="text-sm font-black text-[#ff5d68]">SAFE START</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-.04em]">
                마지막으로 안전 약속을 확인해요
              </h1>
              <p className="mt-2 text-sm font-medium text-[#8b7f79]">
                MORROW는 만 20세 이상만 이용할 수 있습니다.
              </p>
              <div className="mt-7 divide-y divide-[#eee] border-y border-[#eee]">
                <Agreement
                  checked={form.terms_agreed}
                  onChange={(checked) =>
                    setForm({ ...form, terms_agreed: checked })
                  }
                  label="이용약관 동의"
                  required
                  href="/terms"
                />
                <Agreement
                  checked={form.privacy_agreed}
                  onChange={(checked) =>
                    setForm({ ...form, privacy_agreed: checked })
                  }
                  label="개인정보 처리방침 동의"
                  required
                  href="/privacy"
                />
                <Agreement
                  checked={form.adult_confirmed}
                  onChange={(checked) =>
                    setForm({ ...form, adult_confirmed: checked })
                  }
                  label="만 20세 이상입니다"
                  required
                />
                <Agreement
                  checked={form.marketing_opt_in}
                  onChange={(checked) =>
                    setForm({ ...form, marketing_opt_in: checked })
                  }
                  label="이벤트와 서비스 소식 수신"
                />
              </div>
            </div>
          )}
          {error && (
            <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">
              {error}
            </p>
          )}
          <div className="mt-8 flex gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="grid h-13 w-14 place-items-center rounded-2xl border border-[#e6ddd8]"
              >
                <ArrowLeft className="size-5" />
              </button>
            )}
            <button
              disabled={!canNext || saving}
              className="h-13 flex-1 rounded-2xl bg-[#ff5d68] font-black text-white disabled:opacity-40"
            >
              {saving ? "저장 중..." : step === 5 ? "MORROW 시작하기" : "다음"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function ProfilePanelV2({ me }: { me: Me }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <ProfileEditor
        me={me}
        onCancel={() => setEditing(false)}
        onSaved={() => window.location.reload()}
      />
    );
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className="rounded-[30px] border border-[#e9e1dd] bg-white p-6 sm:p-9">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#e6dade] px-4 text-sm font-black text-[#5f5257] hover:border-[#f03768] hover:text-[#f03768]"
          >
            <Pencil className="size-4" /> 프로필 편집
          </button>
        </div>
        <div className="flex flex-col items-center text-center">
          {me.photos[0] ? (
            <Image
              src={me.photos[0].url}
              alt="내 대표 프로필 사진"
              width={96}
              height={96}
              className="size-24 rounded-[28px] object-cover shadow-lg"
            />
          ) : (
            <span
              className={`grid size-24 place-items-center rounded-[28px] bg-gradient-to-br ${avatarGradient(me.display_name)} text-4xl font-black text-white`}
            >
              {me.display_name.slice(0, 1)}
            </span>
          )}
          <h1 className="mt-5 text-3xl font-black">
            {me.display_name}{" "}
            <span className="font-semibold text-[#8b7f79]">{me.age}</span>
          </h1>
          <p className="mt-2 flex items-center gap-1 text-sm font-bold text-[#8b7f79]">
            <MapPin className="size-4" />
            {me.area} · {me.job}
          </p>
          <span
            className={`mt-3 rounded-full px-3 py-1.5 text-xs font-black ${me.account_verified ? "bg-[#edf8f3] text-[#31825f]" : "bg-[#f3f3f3] text-[#666]"}`}
          >
            <ShieldCheck className="mr-1 inline size-3.5" />
            {me.account_verified
              ? "본인 확인 완료"
              : me.verification_status === "pending"
                ? "본인 확인 검토 중"
                : "가입 계정 확인"}
          </span>
        </div>
        <div className="mt-9 rounded-2xl bg-[#faf7f5] p-5">
          <p className="text-xs font-black text-[#a0948e]">소개</p>
          <p className="mt-2 font-bold leading-7">{me.bio}</p>
        </div>
        <div className="mt-6">
          <p className="text-xs font-black text-[#a0948e]">관심사</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {me.interests.map((item) => (
              <span
                key={item}
                className="rounded-full border border-[#eadfda] px-3 py-1.5 text-sm font-bold"
              >
                #{item}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#eee4e7] p-4">
            <p className="text-xs font-black text-[#a0948e]">선호하는 데이트</p>
            <p className="mt-2 text-sm font-bold leading-6">{me.date_style}</p>
          </div>
          <div className="rounded-2xl border border-[#eee4e7] p-4">
            <p className="text-xs font-black text-[#a0948e]">가능한 시간</p>
            <p className="mt-2 text-sm font-bold leading-6">
              {me.availability.join(" · ")}
            </p>
          </div>
        </div>
        <ProfilePhotos initialPhotos={me.photos} />
      </div>
      <AccountCenter isAdmin={me.is_admin} />
    </section>
  );
}

function SafetyPanel() {
  return <SafetyCenter />;
}

function ChatDrawer({
  match,
  currentUserId,
  initialView,
  onClose,
  onEnded,
}: {
  match: MatchItem;
  currentUserId: string;
  initialView: DrawerView;
  onClose: () => void;
  onEnded: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plans, setPlans] = useState<DatePlan[]>([]);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<DrawerView>(initialView);
  const [syncRefreshKey, setSyncRefreshKey] = useState(0);
  const [connection, setConnection] = useState<
    "connecting" | "live" | "offline"
  >("connecting");
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [conversationClosed, setConversationClosed] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let typingTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let closedByServer = false;

    const mergeMessage = (incoming: ChatMessage) => {
      setMessages((current) => {
        const index = current.findIndex(
          (item) =>
            item.id === incoming.id ||
            Boolean(
              incoming.client_id && item.client_id === incoming.client_id,
            ),
        );
        if (index === -1) return [...current, incoming];
        const next = [...current];
        next[index] = incoming;
        return next;
      });
    };

    Promise.all([fetchMessages(match.id), fetchDatePlans(match.id)])
      .then(([messageResult, planResult]) => {
        if (disposed) return;
        setMessages(messageResult.items);
        setPlans(planResult.items);
      })
      .catch(() => {
        if (!disposed) setConnection("offline");
      });

    const connect = () => {
      if (disposed || closedByServer) return;
      setConnection("connecting");
      const socket = new WebSocket(matchSocketUrl(match.id));
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttempt = 0;
        setConnection("live");
        socket.send(JSON.stringify({ type: "read" }));
        heartbeatTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN)
            socket.send(JSON.stringify({ type: "ping" }));
        }, 25_000);
      };

      socket.onmessage = (event) => {
        let payload: RealtimeEvent;
        try {
          payload = JSON.parse(event.data) as RealtimeEvent;
        } catch {
          return;
        }
        if (payload.type === "message") {
          const mine = payload.item.sender_id === currentUserId;
          mergeMessage({
            ...payload.item,
            mine,
            sending: false,
            failed: false,
          });
          if (!mine && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "read" }));
          }
        } else if (
          payload.type === "read" &&
          payload.reader_id !== currentUserId
        ) {
          setMessages((current) =>
            current.map((item) =>
              item.mine && !item.read_at
                ? { ...item, read_at: payload.read_at }
                : item,
            ),
          );
        } else if (
          payload.type === "typing" &&
          payload.user_id !== currentUserId
        ) {
          setOtherTyping(payload.active);
          if (typingTimer) clearTimeout(typingTimer);
          typingTimer = setTimeout(() => setOtherTyping(false), 1_800);
        } else if (
          payload.type === "presence" &&
          payload.user_id !== currentUserId
        ) {
          setOtherOnline(payload.online);
        } else if (payload.type === "match_closed") {
          closedByServer = true;
          setConversationClosed(true);
          setConnection("offline");
        } else if (payload.type === "match_sync_updated") {
          setSyncRefreshKey((current) => current + 1);
        } else if (payload.type === "error") {
          if (payload.client_id) {
            setMessages((current) =>
              current.map((item) =>
                item.client_id === payload.client_id
                  ? { ...item, sending: false, failed: true }
                  : item,
              ),
            );
          }
          setChatError(payload.detail);
        }
      };

      socket.onclose = () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (socketRef.current === socket) socketRef.current = null;
        if (disposed || closedByServer) return;
        setConnection("offline");
        const delay = Math.min(1_000 * 2 ** reconnectAttempt, 15_000);
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => socket.close();
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (typingTimer) clearTimeout(typingTimer);
      if (typingStopRef.current) clearTimeout(typingStopRef.current);
      socketRef.current?.close(1000, "drawer closed");
      socketRef.current = null;
    };
  }, [currentUserId, match.id]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, otherTyping]);

  useEffect(() => {
    if (view === "chat") markMessagesRead(match.id).catch(() => undefined);
  }, [match.id, view]);

  function updateText(value: string) {
    setText(value);
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "typing", active: true }));
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    typingStopRef.current = setTimeout(() => {
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: "typing", active: false }));
    }, 1_000);
  }

  async function selectAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAttachmentBusy(true);
    setChatError(null);
    try {
      setAttachment(await compressImage(file));
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "사진을 준비하지 못했어요");
    } finally {
      setAttachmentBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if ((!body && !attachment) || busy || attachmentBusy || conversationClosed) return;
    setChatError(null);
    const clientId = window.crypto.randomUUID();
    const attachmentDataUrl = attachment;
    const optimistic: ChatMessage = {
      id: `local:${clientId}`,
      client_id: clientId,
      sender_id: currentUserId,
      body,
      attachment_url: attachmentDataUrl,
      attachment_content_type: attachmentDataUrl ? "image/webp" : null,
      mine: true,
      created_at: new Date().toISOString(),
      read_at: null,
      sending: true,
    };
    setMessages((current) => [...current, optimistic]);
    setText("");
    setAttachment(null);
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "message",
          client_id: clientId,
          body,
          ...(attachmentDataUrl ? { attachment_data_url: attachmentDataUrl } : {}),
        }),
      );
      return;
    }
    setBusy(true);
    try {
      const saved = await sendMessage(match.id, body, clientId, attachmentDataUrl ?? undefined);
      setMessages((current) =>
        current.map((item) => (item.client_id === clientId ? saved : item)),
      );
    } catch (error) {
      setMessages((current) =>
        current.map((item) =>
          item.client_id === clientId
            ? { ...item, sending: false, failed: true }
            : item,
        ),
      );
      setChatError(
        error instanceof Error ? error.message : "전송하지 못했어요",
      );
    } finally {
      setBusy(false);
    }
  }

  async function retryMessage(message: ChatMessage) {
    const clientId = message.client_id;
    if (!clientId || busy || conversationClosed) return;
    setChatError(null);
    setMessages((current) =>
      current.map((item) =>
        item.client_id === clientId
          ? { ...item, sending: true, failed: false }
          : item,
      ),
    );
    const attachmentDataUrl = message.attachment_url?.startsWith("data:")
      ? message.attachment_url
      : undefined;
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "message",
          client_id: clientId,
          body: message.body,
          ...(attachmentDataUrl ? { attachment_data_url: attachmentDataUrl } : {}),
        }),
      );
      return;
    }
    setBusy(true);
    try {
      const saved = await sendMessage(match.id, message.body, clientId, attachmentDataUrl);
      setMessages((current) =>
        current.map((item) => (item.client_id === clientId ? saved : item)),
      );
    } catch (error) {
      setMessages((current) =>
        current.map((item) =>
          item.client_id === clientId
            ? { ...item, sending: false, failed: true }
            : item,
        ),
      );
      setChatError(error instanceof Error ? error.message : "전송하지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  async function end(kind: "close" | "block" | "report") {
    setBusy(true);
    try {
      if (kind === "close") await closeMatch(match.id);
      if (kind === "block") await blockUser(match.person.id);
      if (kind === "report")
        await reportUser(match.person.id, "other", "앱에서 신고됨");
      onEnded();
    } catch {
      setBusy(false);
    }
  }

  const starterPrompts = [
    match.person.common_interests[0]
      ? `${match.person.common_interests[0]} 좋아한다니 반가워요!`
      : "요즘 가장 자주 듣는 노래가 뭐예요?",
    match.person.common_times[0]
      ? `${match.person.common_times[0]}에는 보통 뭐 하세요?`
      : "이번 주말에 가장 하고 싶은 일이 뭐예요?",
    "우리 둘 다 편하게 만날 수 있는 동네가 어디일까요?",
  ];
  const statusText = conversationClosed
    ? "종료된 대화"
    : connection === "connecting"
      ? "연결 중"
      : connection === "offline"
        ? "재연결 중"
        : otherOnline
          ? "지금 접속 중"
          : "실시간 연결됨";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-[#f7f7f7] shadow-2xl">
        <header className="relative border-b border-[#e5e5e5] bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="grid size-10 place-items-center rounded-full"
              aria-label="채팅 닫기"
            >
              <ArrowLeft className="size-5" />
            </button>
            <span
              className={`relative grid size-10 place-items-center overflow-hidden rounded-lg bg-gradient-to-br ${avatarGradient(match.person.display_name)} font-black text-white`}
            >
              {match.person.photos?.[0] ? (
                <Image
                  src={match.person.photos[0].url}
                  alt=""
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              ) : (
                match.person.display_name.slice(0, 1)
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-black">{match.person.display_name}</p>
              <p
                className={`flex items-center gap-1.5 text-xs font-semibold ${connection === "live" && !conversationClosed ? "text-[#198754]" : "text-[#888]"}`}
              >
                <span
                  className={`size-1.5 rounded-full ${connection === "live" && !conversationClosed ? "bg-[#21a366]" : "bg-[#aaa]"}`}
                />
                {statusText}
              </p>
            </div>
            <button
              onClick={() => setMenu(!menu)}
              className="grid size-10 place-items-center rounded-full"
              aria-label="대화 관리"
            >
              <MoreHorizontal className="size-5" />
            </button>
            {menu && (
              <div className="absolute right-4 top-16 z-10 w-48 overflow-hidden rounded-lg border border-[#ddd] bg-white py-1 shadow-xl">
                <button
                  onClick={() => end("close")}
                  className="w-full px-4 py-3 text-left text-sm font-bold"
                >
                  정중하게 대화 종료
                </button>
                <button
                  onClick={() => end("block")}
                  className="w-full px-4 py-3 text-left text-sm font-bold text-red-600"
                >
                  차단하기
                </button>
                <button
                  onClick={() => end("report")}
                  className="w-full px-4 py-3 text-left text-sm font-bold text-red-600"
                >
                  신고 후 차단
                </button>
              </div>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 rounded-md bg-[#f3f3f3] p-1">
            <button
              onClick={() => setView("chat")}
              className={`rounded py-2 text-xs font-black ${view === "chat" ? "bg-white text-[#ff385c] shadow-sm" : "text-[#777]"}`}
            >
              <MessageCircle className="mr-1 inline size-3.5" />
              실시간 대화
            </button>
            <button
              onClick={() => setView("sync")}
              className={`rounded py-2 text-xs font-black ${view === "sync" ? "bg-white text-[#ff385c] shadow-sm" : "text-[#777]"}`}
            >
              <Sparkles className="mr-1 inline size-3.5" />
              3분 Sync
            </button>
            <button
              onClick={() => setView("plans")}
              className={`rounded py-2 text-xs font-black ${view === "plans" ? "bg-white text-[#ff385c] shadow-sm" : "text-[#777]"}`}
            >
              <CalendarDays className="mr-1 inline size-3.5" />
              약속 잡기{" "}
              {plans.some(
                (plan) => plan.status === "pending" && !plan.mine,
              ) && (
                <span className="ml-1 rounded-full bg-[#ff385c] px-1.5 text-[9px] text-white">
                  NEW
                </span>
              )}
            </button>
          </div>
          {match.person.photos.length > 0 && (
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-0.5" aria-label={`${match.person.display_name}님의 프로필 사진`}>
              {match.person.photos.slice(0, 6).map((photo, index) => (
                <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="relative size-11 shrink-0 overflow-hidden rounded-xl border border-[#eadfdd] bg-[#f3ecea]" aria-label={`프로필 사진 ${index + 1} 크게 보기`}>
                  <Image src={photo.url} alt={`${match.person.display_name} 프로필 사진 ${index + 1}`} fill unoptimized sizes="44px" className="object-cover" />
                </a>
              ))}
              <span className="shrink-0 text-[11px] font-bold text-[#958884]">사진을 보며 대화해보세요</span>
            </div>
          )}
        </header>
        {view === "chat" ? (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              <div className="mx-auto max-w-xs rounded-lg bg-[#fff0f3] p-4 text-center text-xs font-semibold leading-5 text-[#7d5861]">
                MORROW 안에서 먼저 대화해보세요.
                <br />
                금전·투자·인증번호 요구는 바로 신고·차단할 수 있어요.
              </div>
              {chatError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-center text-xs font-bold text-red-700"
                >
                  {chatError}
                </div>
              )}
              {conversationClosed && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-xs font-bold text-red-700">
                  종료된 매치입니다. 더 이상 메시지를 보낼 수 없어요.
                </div>
              )}
              {messages.length === 0 && !conversationClosed && (
                <div className="rounded-lg border border-dashed border-[#d8d8d8] bg-white p-4">
                  <p className="text-xs font-black text-[#777]">
                    첫 문장이 어렵다면
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => updateText(prompt)}
                        className="rounded-md border border-[#ddd] bg-white px-3 py-2 text-left text-xs font-bold text-[#555] transition hover:border-[#ff385c] hover:text-[#ff385c]"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[78%] ${message.mine ? "text-right" : "text-left"}`}
                  >
                    {message.attachment_url && (
                      <a
                        href={message.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mb-1 block overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm"
                        aria-label="받은 사진 크게 보기"
                      >
                        <Image
                          src={message.attachment_url}
                          alt="대화로 받은 사진"
                          width={260}
                          height={260}
                          unoptimized
                          className="max-h-64 w-full object-cover"
                        />
                      </a>
                    )}
                    {message.body && (
                      <p
                        className={`inline-block rounded-xl px-4 py-3 text-left text-sm font-medium leading-6 ${message.mine ? "rounded-br-sm bg-[#ff385c] text-white" : "rounded-bl-sm border border-[#e2e2e2] bg-white text-[#222]"}`}
                      >
                        {message.body}
                      </p>
                    )}
                    {message.mine && (
                      <div className="mt-1 flex items-center justify-end gap-2 text-[10px] font-semibold">
                        <span className={message.failed ? "text-red-600" : "text-[#999]"}>
                          {message.failed
                            ? "전송 실패"
                            : message.sending
                              ? "전송 중"
                              : message.read_at
                                ? "읽음"
                                : "전송됨"}
                        </span>
                        {message.failed && message.client_id ? (
                          <button
                            type="button"
                            onClick={() => retryMessage(message)}
                            disabled={busy}
                            className="rounded-full border border-[#ff9bae] px-2 py-1 text-[#e62e55] transition hover:bg-[#fff0f3] disabled:opacity-50"
                          >
                            다시 보내기
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {otherTyping && (
                <p className="text-xs font-semibold text-[#888]">
                  {match.person.display_name}님이 입력 중이에요…
                </p>
              )}
              <div ref={messageEndRef} />
            </div>
            <form
              onSubmit={submit}
              className="border-t border-[#e5e5e5] bg-white p-3"
            >
              {attachment && (
                <div className="mb-2 flex items-center gap-2 rounded-xl bg-[#fff7f5] p-2">
                  <Image src={attachment} alt="보낼 사진 미리보기" width={48} height={48} unoptimized className="size-12 rounded-lg object-cover" />
                  <p className="min-w-0 flex-1 truncate text-xs font-bold text-[#6f5b58]">사진을 보낼 준비가 됐어요</p>
                  <button type="button" onClick={() => setAttachment(null)} className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#777]" aria-label="첨부 사진 삭제"><X className="size-4" /></button>
                </div>
              )}
              <div className="flex gap-2">
                <label className="grid size-12 shrink-0 cursor-pointer place-items-center rounded-xl border border-[#e2d9d7] bg-white text-[#766664] transition hover:border-[#ff9bae] hover:text-[#ff385c] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50" aria-label="사진 첨부">
                  {attachmentBusy ? <RefreshCw className="size-5 animate-spin" /> : <Paperclip className="size-5" />}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={selectAttachment} disabled={conversationClosed || attachmentBusy} />
                </label>
                <input
                  value={text}
                  onChange={(event) => updateText(event.target.value)}
                  maxLength={500}
                  disabled={conversationClosed}
                  placeholder={
                    conversationClosed
                      ? "종료된 대화입니다"
                      : attachment
                        ? "사진과 함께 한마디를 남겨보세요"
                        : "메시지를 입력하세요"
                  }
                  className="min-w-0 flex-1 rounded-xl bg-[#f3f3f3] px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-[#ff9bae] disabled:opacity-60"
                />
                <button
                  disabled={(!text.trim() && !attachment) || busy || attachmentBusy || conversationClosed}
                  className="grid size-12 shrink-0 place-items-center rounded-xl bg-black text-white disabled:opacity-40"
                  aria-label="보내기"
                >
                  <Send className="size-5" />
                </button>
              </div>
              <p className="mt-2 px-1 text-[10px] font-semibold text-[#a29591]">매칭된 상대에게만 사진이 공유돼요 · 1장씩 안전하게 보내요</p>
            </form>
          </>
        ) : view === "sync" ? (
          <MatchSyncPanel
            matchId={match.id}
            partnerName={match.person.display_name}
            refreshKey={syncRefreshKey}
            onOpenPlans={() => setView("plans")}
          />
        ) : (
          <DatePlanner
            matchId={match.id}
            plans={plans}
            onPlansChange={setPlans}
          />
        )}
      </aside>
    </div>
  );
}

function DatePlanner({
  matchId,
  plans,
  onPlansChange,
}: {
  matchId: string;
  plans: DatePlan[];
  onPlansChange: (plans: DatePlan[]) => void;
}) {
  const [title, setTitle] = useState("카페에서 천천히 이야기하기");
  const [area, setArea] = useState("성수");
  const [scheduledFor, setScheduledFor] = useState("");
  const [note, setNote] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<KakaoPlace | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedbackPlanId, setFeedbackPlanId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState({
    attended: true,
    felt_safe: true,
    would_meet_again: true,
    note: "",
  });
  const accepted = plans.find((plan) => plan.status === "accepted");
  useEffect(() => {
    const refresh = () => setCurrentTime(Date.now());
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  async function createPlan(event: FormEvent) {
    event.preventDefault();
    if (!scheduledFor || saving) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      const result = await createDatePlan(matchId, {
        title,
        area,
        scheduled_for: new Date(scheduledFor).toISOString(),
        note,
        place_id: selectedPlace?.id ?? null,
        place_name: selectedPlace?.name ?? null,
        place_url: selectedPlace?.place_url ?? null,
        road_address: selectedPlace?.address ?? null,
        longitude: selectedPlace?.longitude ?? null,
        latitude: selectedPlace?.latitude ?? null,
      });
      onPlansChange([...plans, result.item]);
      setNote("");
      setStatusMessage("약속 제안을 보냈어요.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "약속을 제안하지 못했어요");
    } finally {
      setSaving(false);
    }
  }
  async function respond(plan: DatePlan, status: "accepted" | "declined") {
    setStatusMessage(null);
    try {
      const result = await respondDatePlan(matchId, plan.id, status);
      onPlansChange(
        plans.map((item) => (item.id === plan.id ? result.item : item)),
      );
      setStatusMessage(status === "accepted" ? "약속을 수락했어요." : "이번 제안을 보류했어요.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "응답하지 못했어요");
    }
  }
  async function shareAccepted() {
    if (!accepted) return;
    const text = `MORROW 약속\n${accepted.title}\n${accepted.place_name || accepted.area}\n${formatPlanDate(accepted.scheduled_for)}${accepted.place_url ? `\n${accepted.place_url}` : ""}\n첫 만남은 공개된 장소에서 만나요.`;
    try {
      if (navigator.share)
        await navigator.share({ title: "MORROW 약속", text });
      else await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* user cancelled native share */
    }
  }
  async function confirmSafe(plan: DatePlan) {
    setStatusMessage(null);
    try {
      const result = await confirmDateSafe(matchId, plan.id);
      onPlansChange(
        plans.map((item) => (item.id === plan.id ? result.item : item)),
      );
      setStatusMessage("안전 확인을 저장했어요.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "안전 확인을 저장하지 못했어요");
    }
  }
  async function sendFeedback(plan: DatePlan) {
    setSaving(true);
    setStatusMessage(null);
    try {
      const result = await submitDateFeedback(matchId, plan.id, feedback);
      onPlansChange(
        plans.map((item) =>
          item.id === plan.id ? { ...item, feedback_submitted: true } : item,
        ),
      );
      setFeedbackPlanId(null);
      if (result.safety_follow_up_recommended) {
        setStatusMessage("안전하지 않았다고 남겨주셨어요. 필요하면 안전센터에서 상대를 차단하거나 신고해주세요.");
      } else {
        setStatusMessage("만남 기록을 저장했어요. 소중한 피드백 고마워요.");
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "만남 기록을 저장하지 못했어요");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="flex-1 overflow-y-auto p-5">
      {statusMessage ? (
        <div
          role="status"
          className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-[#eadfdc] bg-[#fffaf8] px-3.5 py-3 text-xs font-bold text-[#5e4b50]"
        >
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="shrink-0 text-[#9a868b]"
            aria-label="안내 닫기"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}
      <div className="rounded-2xl bg-gradient-to-br from-[#fff0ed] to-[#f2edff] p-5">
        <p className="flex items-center gap-2 text-xs font-black tracking-[.12em] text-[#e95760]">
          <Sparkles className="size-3.5" />
          MORROW DATE
        </p>
        <h2 className="mt-2 text-xl font-black">대화를 약속으로 이어볼까요?</h2>
        <p className="mt-2 text-xs font-medium leading-5 text-[#786c68]">
          연락처를 교환하기 전에, 서로 가능한 시간과 장소부터 가볍게 맞춰보세요.
        </p>
      </div>
      {accepted && (
        <div className="mt-4 rounded-2xl border border-[#bfe3d0] bg-[#f0fbf5] p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-white text-[#319f77]">
              <Check className="size-4" />
            </span>
            <div className="flex-1">
              <p className="text-xs font-black text-[#31825f]">
                약속이 확정됐어요
              </p>
              <p className="mt-1 text-sm font-black">
                {accepted.title} · {accepted.place_name || accepted.area}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#56806b]">
                {formatPlanDate(accepted.scheduled_for)}
              </p>
              {accepted.road_address ? (
                <p className="mt-1 text-[11px] font-semibold text-[#56806b]">
                  {accepted.road_address}
                </p>
              ) : null}
            </div>
          </div>
          <button
            onClick={shareAccepted}
            className="mt-3 w-full rounded-xl border border-[#bfe3d0] bg-white py-2.5 text-xs font-black text-[#31825f]"
          >
            {copied ? "안전 약속 카드를 복사했어요" : "안전 약속 카드 공유하기"}
          </button>
        </div>
      )}
      <form
        onSubmit={createPlan}
        className="mt-5 rounded-2xl border border-[#e9e1dd] bg-white p-4"
      >
        <p className="text-sm font-black">새로운 약속 제안</p>
        <div className="mt-4 space-y-3">
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            placeholder="예: 성수 카페에서 이야기하기"
            className="morrow-input"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={area}
              onChange={(event) => setArea(event.target.value)}
              className="morrow-input"
            >
              {areas.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <input
              required
              type="datetime-local"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
              className="morrow-input text-xs"
            />
          </div>
          <PlacePicker
            area={area}
            selected={selectedPlace}
            onSelect={(place) => {
              setSelectedPlace(place);
              setTitle(`${place.name}에서 이야기하기`);
            }}
          />
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={240}
            placeholder="상대에게 전하고 싶은 한마디 (선택)"
            className="morrow-input min-h-20 resize-none py-3"
          />
        </div>
        <button
          disabled={!scheduledFor || saving}
          className="mt-3 h-11 w-full rounded-xl bg-[#ff5d68] text-sm font-black text-white disabled:opacity-40"
        >
          {saving ? "제안 중..." : "약속 제안 보내기"}
        </button>
      </form>
      <div className="mt-5 space-y-3">
        {plans.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#e7dcd7] p-5 text-center text-xs font-semibold leading-5 text-[#958983]">
            아직 제안한 약속이 없어요.
            <br />
            편한 시간과 장소를 먼저 건네보세요.
          </p>
        ) : (
          plans.map((plan) => (
            <article
              key={plan.id}
              className="rounded-2xl border border-[#e9e1dd] bg-white p-4"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`grid size-9 place-items-center rounded-xl ${plan.status === "accepted" ? "bg-[#edf8f3] text-[#319f77]" : plan.status === "declined" ? "bg-[#f8f0ef] text-[#aa716c]" : "bg-[#fff0ed] text-[#ff5d68]"}`}
                >
                  <CalendarDays className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-black">{plan.title}</p>
                    <span className="shrink-0 text-[10px] font-black text-[#9b8d87]">
                      {plan.mine ? "내 제안" : "받은 제안"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#7e716b]">
                    {plan.place_name || plan.area} · {formatPlanDate(plan.scheduled_for)}
                  </p>
                  {plan.road_address ? (
                    <p className="mt-1 truncate text-[10px] font-semibold text-[#9b8d87]">
                      {plan.road_address}
                    </p>
                  ) : null}
                  {plan.place_url ? (
                    <a
                      href={plan.place_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-[11px] font-black text-[#ff385c]"
                    >
                      카카오맵에서 장소 확인
                    </a>
                  ) : null}
                  {plan.note && (
                    <p className="mt-2 text-xs font-medium leading-5 text-[#988a84]">
                      {plan.note}
                    </p>
                  )}
                </div>
              </div>
              {plan.status === "pending" && !plan.mine && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => respond(plan, "declined")}
                    className="rounded-xl border border-[#e7dcd7] py-2 text-xs font-black text-[#8d807a]"
                  >
                    이번엔 어려워요
                  </button>
                  <button
                    onClick={() => respond(plan, "accepted")}
                    className="rounded-xl bg-[#ff5d68] py-2 text-xs font-black text-white"
                  >
                    좋아요, 만나요
                  </button>
                </div>
              )}
              {plan.status !== "pending" && (
                <p
                  className={`mt-3 text-xs font-black ${plan.status === "accepted" ? "text-[#319f77]" : "text-[#aa716c]"}`}
                >
                  {plan.status === "accepted"
                    ? "두 분의 약속으로 확정됐어요"
                    : "이번 제안은 보류됐어요"}
                </p>
              )}
              {plan.status === "accepted" &&
              currentTime >= new Date(plan.scheduled_for).getTime() - 4 * 60 * 60 * 1000 ? (
                <div className="mt-3 space-y-2 border-t border-[#edf0ee] pt-3">
                  {!plan.my_safe_confirmed ? (
                    <button
                      onClick={() => confirmSafe(plan)}
                      className="w-full rounded-xl bg-[#edf8f3] py-2.5 text-xs font-black text-[#287556]"
                    >
                      안전하게 만남을 마쳤어요
                    </button>
                  ) : (
                    <p className="rounded-xl bg-[#edf8f3] py-2.5 text-center text-xs font-black text-[#287556]">
                      내 안전 확인이 저장됐어요
                    </p>
                  )}
                  {currentTime >= new Date(plan.scheduled_for).getTime() &&
                  !plan.feedback_submitted ? (
                    feedbackPlanId === plan.id ? (
                      <div className="rounded-xl bg-[#f7f7f7] p-3">
                        <p className="text-xs font-black">비공개 만남 피드백</p>
                        <p className="mt-1 text-[10px] font-medium leading-4 text-[#777]">
                          상대에게 공개되지 않으며 추천 품질과 안전 운영에만 사용해요.
                        </p>
                        <div className="mt-3 grid gap-2">
                          <FeedbackChoice
                            label="실제로 만났어요"
                            checked={feedback.attended}
                            onChange={(checked) => setFeedback({ ...feedback, attended: checked })}
                          />
                          <FeedbackChoice
                            label="안전하다고 느꼈어요"
                            checked={feedback.felt_safe}
                            onChange={(checked) => setFeedback({ ...feedback, felt_safe: checked })}
                          />
                          <FeedbackChoice
                            label="다시 만나고 싶어요"
                            checked={feedback.would_meet_again}
                            onChange={(checked) => setFeedback({ ...feedback, would_meet_again: checked })}
                          />
                          <textarea
                            value={feedback.note}
                            onChange={(event) => setFeedback({ ...feedback, note: event.target.value })}
                            maxLength={500}
                            placeholder="운영팀에만 남길 내용 (선택)"
                            className="morrow-input min-h-16 resize-none py-2 text-xs"
                          />
                          <button
                            onClick={() => sendFeedback(plan)}
                            disabled={saving}
                            className="rounded-lg bg-black py-2.5 text-xs font-black text-white disabled:opacity-50"
                          >
                            피드백 저장
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setFeedbackPlanId(plan.id)}
                        className="w-full rounded-xl border border-[#ddd] py-2.5 text-xs font-black"
                      >
                        만남 피드백 남기기
                      </button>
                    )
                  ) : null}
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function FeedbackChoice({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-bold ${checked ? "border-[#9cd4ba] bg-white text-[#287556]" : "border-[#ddd] bg-white text-[#777]"}`}
    >
      {label}
      <span>{checked ? "예" : "아니요"}</span>
    </button>
  );
}

function formatPlanDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function MatchCelebration({
  name,
  onClose,
  onChat,
}: {
  name: string;
  onClose: () => void;
  onChat: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#2b2220]/60 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-[30px] bg-white p-7 text-center">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-[#fff0ed] text-[#ff5d68]">
          <Heart className="size-9 fill-current" />
        </span>
        <p className="mt-5 text-xs font-black text-[#ff5d68]">
          IT&apos;S A MORROW
        </p>
        <h2 className="mt-2 text-3xl font-black">
          {name}님과
          <br />
          사이가 이어졌어요!
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-[#81756f]">
          서로 가능한 시간을 확인하고
          <br />
          가볍게 첫 인사를 건네보세요.
        </p>
        <button
          onClick={onChat}
          className="mt-7 h-13 w-full rounded-2xl bg-[#ff5d68] font-black text-white"
        >
          대화 시작하기
        </button>
        <button
          onClick={onClose}
          className="mt-2 h-11 w-full text-sm font-bold text-[#8c817b]"
        >
          나중에 할게요
        </button>
      </div>
    </div>
  );
}
function NavButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Sparkles;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold transition ${active ? "bg-[#21191b] text-white" : "text-[#66585b] hover:bg-[#f8f1ef] hover:text-[#21191b]"}`}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}
function MobileNav({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Sparkles;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-12 flex-col items-center justify-center gap-1 py-1.5 text-[10px] font-bold transition ${active ? "text-[#ea365d]" : "text-[#817377]"}`}
    >
      <Icon className={`size-5 ${active ? "stroke-[2.5]" : ""}`} />
      {children}
    </button>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
function Choice({
  active,
  onClick,
  wide,
  children,
}: {
  active: boolean;
  onClick: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${wide ? "w-full" : ""} ${active ? "border-[#ff9da4] bg-[#fff0ed] text-[#d9555d]" : "border-[#e6ddd8] bg-white text-[#776c67]"}`}
    >
      {active && <Check className="size-4" />}
      {children}
    </button>
  );
}
function Agreement({
  checked,
  onChange,
  label,
  required = false,
  href,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  required?: boolean;
  href?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-4">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        className={`grid size-6 shrink-0 place-items-center rounded-md border ${checked ? "border-black bg-black text-white" : "border-[#ccc] bg-white"}`}
      >
        {checked ? <Check className="size-4" /> : null}
      </button>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="flex-1 text-left text-sm font-bold"
      >
        <span className={required ? "text-[#ff5d68]" : "text-[#999]"}>
          {required ? "[필수]" : "[선택]"}
        </span>{" "}
        {label}
      </button>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-black text-[#777] underline underline-offset-4"
        >
          보기
        </a>
      ) : null}
    </div>
  );
}

