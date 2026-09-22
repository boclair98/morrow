"use client";

import {
  ArrowUpRight,
  CalendarDays,
  Check,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react";

import type { DiscoverProfile, MatchItem } from "@/lib/api";

export type DrawerView = "chat" | "plans" | "sync";

type PulseMode = "discover" | "interest" | "sync" | "reply" | "plan";

type MorrowPulseProps = {
  profiles: DiscoverProfile[];
  matches: MatchItem[];
  receivedCount: number;
  onDiscover: () => void;
  onOpenInterests: () => void;
  onOpenMatch: (match: MatchItem, view: DrawerView) => void;
};

const stages = [
  { label: "발견", icon: Users, action: "discover" },
  { label: "Sync · 대화", icon: MessageCircle, action: "sync" },
  { label: "약속", icon: CalendarDays, action: "plan" },
] as const;

function nextViewForMatch(match: MatchItem): DrawerView {
  if (match.unread_count > 0) return "chat";
  if (!match.last_message) return "sync";
  return "plans";
}

function modeFor(matches: MatchItem[], receivedCount: number): PulseMode {
  if (matches.some((match) => match.unread_count > 0)) return "reply";
  if (receivedCount > 0) return "interest";
  if (matches.some((match) => !match.last_message)) return "sync";
  if (matches.length > 0) return "plan";
  return "discover";
}

export function MorrowPulse({
  profiles,
  matches,
  receivedCount,
  onDiscover,
  onOpenInterests,
  onOpenMatch,
}: MorrowPulseProps) {
  const mode = modeFor(matches, receivedCount);
  const unreadMatch = matches.find((match) => match.unread_count > 0);
  const quietMatch = matches.find((match) => !match.last_message);
  const activeMatch = unreadMatch ?? quietMatch ?? matches[0];
  const activeStage = mode === "discover" ? 0 : mode === "plan" ? 2 : 1;
  const actionMatch = mode === "reply" ? unreadMatch : activeMatch;

  const content =
    mode === "reply"
      ? {
          eyebrow: "답장을 기다려요",
          title: `${actionMatch?.person.display_name ?? "매치"}님의 메시지가 기다리고 있어요`,
          body: "짧은 답장 하나가 대화를 다시 움직여요. 읽은 뒤 편한 속도로 이어가세요.",
          cta: "대화 이어가기",
        }
      : mode === "interest"
        ? {
            eyebrow: "먼저 온 관심",
            title: `${receivedCount}명이 먼저 마음을 보냈어요`,
            body: "프로필을 보고 나에게도 마음이 가면 관심을 보내보세요. 서로 마음이 맞는 순간 바로 대화가 열려요.",
            cta: "받은 관심 확인하기",
          }
        : mode === "sync"
        ? {
            eyebrow: "첫 대화 준비",
            title: `${actionMatch?.person.display_name ?? "매치"}님과 첫 문장 대신 3분 Sync`,
            body: "같은 질문에 답한 뒤 동시에 공개돼요. 어색함은 줄이고, 공통점은 자연스럽게 발견해보세요.",
            cta: "Sync 시작하기",
          }
        : mode === "plan"
          ? {
              eyebrow: "약속으로 이어가기",
              title: `${actionMatch?.person.display_name ?? "매치"}님과 대화를 약속으로`,
              body: "연락처를 먼저 공개하지 않고, 가능한 시간과 공개 장소부터 가볍게 제안해보세요.",
              cta: "약속 제안하기",
            }
          : {
              eyebrow: "오늘의 발견",
              title:
                profiles.length > 0
                  ? "오늘은 한 사람에게만 마음을 보내보세요"
                  : "새로운 연결을 시작할 준비가 됐어요",
              body:
                profiles.length > 0
                  ? "시간·동네·취향이 맞는 실제 회원부터 천천히 살펴보세요. 다음 행동은 하나면 충분해요."
                  : "추천 조건을 다시 확인하면 실제 회원 기반의 새로운 추천을 불러올 수 있어요.",
              cta: profiles.length > 0 ? "추천 둘러보기" : "추천 새로고침",
            };

  function handleAction() {
    if (mode === "interest") {
      onOpenInterests();
      return;
    }
    if (actionMatch && mode !== "discover") {
      onOpenMatch(actionMatch, nextViewForMatch(actionMatch));
      return;
    }
    onDiscover();
  }

  function handleStage(action: (typeof stages)[number]["action"]) {
    if (action === "discover") {
      onDiscover();
      return;
    }

    const target =
      action === "sync"
        ? matches.find((match) => !match.last_message) ?? matches[0]
        : matches.find((match) => Boolean(match.last_message)) ?? matches[0];

    if (target) {
      onOpenMatch(target, action === "sync" ? "sync" : "plans");
      return;
    }

    // No match yet: keep the step useful by taking the member to discovery.
    onDiscover();
  }

  return (
    <section
      aria-labelledby="morrow-pulse-title"
      className="relative mb-7 overflow-hidden rounded-[24px] border border-[#f0deda] bg-gradient-to-br from-[#fff1ec] via-[#fff8f5] to-[#f8efff] text-[#271d20] shadow-[0_18px_55px_rgba(98,54,63,.08)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-[#ff7693]/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-9rem] left-1/3 size-56 rounded-full bg-[#b79cff]/18 blur-3xl"
      />
      <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-7">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black tracking-[.14em]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ea365d] px-2.5 py-1.5 tracking-[.08em] text-white">
              <Sparkles className="size-3" />
              오늘의 한 걸음
            </span>
            <span className="text-[#9a747c]">{content.eyebrow}</span>
          </div>
          <h2
            id="morrow-pulse-title"
            className="mt-4 max-w-[680px] text-[24px] font-black leading-[1.18] tracking-[-.04em] sm:text-[30px]"
          >
            {content.title}
          </h2>
          <p className="mt-3 max-w-[650px] text-sm font-medium leading-6 text-[#79686c]">
            {content.body}
          </p>

          <div
            className="mt-5 grid max-w-[590px] grid-cols-3 gap-1.5"
            aria-label="연결 단계"
          >
            {stages.map(({ label, icon: Icon, action }, index) => {
              const complete = index < activeStage;
              const active = index === activeStage;
              return (
                <button
                  type="button"
                  key={label}
                  onClick={() => handleStage(action)}
                  aria-current={active ? "step" : undefined}
                  aria-label={`${label} 단계로 이동`}
                  title={`${label} 단계 열기`}
                  className={`group flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-2.5 text-left text-[10px] font-bold transition hover:-translate-y-0.5 hover:border-[#ea365d]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea365d] focus-visible:ring-offset-2 sm:px-3 ${active ? "border-[#ea365d]/35 bg-white text-[#271d20] shadow-sm" : complete ? "border-[#ff9daf]/40 bg-[#fff0f3] text-[#d92e53]" : "border-[#eadedb] bg-white/55 text-[#a39296]"}`}
                >
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-full ${active ? "bg-[#271d20] text-white" : complete ? "bg-[#ea365d] text-white" : "bg-[#eee5e3] text-[#998a8d]"}`}
                  >
                    {complete ? <Check className="size-3" /> : <Icon className="size-3" />}
                  </span>
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={handleAction}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ea365d] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(234,54,93,.22)] transition hover:bg-[#d92e53] focus-visible:ring-2 focus-visible:ring-[#ea365d] focus-visible:ring-offset-2 sm:w-auto"
        >
          {content.cta}
          <ArrowUpRight className="size-4" />
        </button>
      </div>
    </section>
  );
}

export function getMatchNextView(match: MatchItem): DrawerView {
  return nextViewForMatch(match);
}

