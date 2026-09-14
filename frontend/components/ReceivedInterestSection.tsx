"use client";

import { ArrowUpRight, Heart, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import type { ReceivedInterest } from "@/lib/api";

type ReceivedInterestSectionProps = {
  items: ReceivedInterest[];
  loading: boolean;
  hasMore: boolean;
  onRefresh: () => void;
  onOpen: (profile: ReceivedInterest) => void;
  onLike: (profile: ReceivedInterest) => Promise<void>;
  onPass: (profile: ReceivedInterest) => Promise<void>;
};

function likedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "최근";
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(date);
}

export function ReceivedInterestSection({
  items,
  loading,
  hasMore,
  onRefresh,
  onOpen,
  onLike,
  onPass,
}: ReceivedInterestSectionProps) {
  return (
    <section
      aria-labelledby="received-interest-title"
      className="mb-8 overflow-hidden rounded-[24px] border border-[#f0deda] bg-white shadow-[0_14px_38px_rgba(72,45,52,.05)]"
    >
      <div className="flex flex-col gap-3 border-b border-[#f1e8e5] bg-gradient-to-r from-[#fff8f5] to-[#fff0f3] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ea365d] px-2.5 py-1 text-[10px] font-black tracking-[.08em] text-white">
              <Heart className="size-3 fill-current" />
              먼저 온 관심
            </span>
            {hasMore ? (
              <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold text-[#95777c]">
                최근 12명 표시
              </span>
            ) : null}
          </div>
          <h2 id="received-interest-title" className="mt-2 text-xl font-black tracking-[-.035em]">
            나에게 먼저 마음을 보낸 사람
          </h2>
          <p className="mt-1 text-sm font-medium leading-6 text-[#806f72]">
            서로 마음이 맞으면 바로 매치되고, 앱 안에서 안전하게 대화를 시작할 수 있어요.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full border border-[#e5d8d5] bg-white px-4 text-xs font-extrabold text-[#33272a] transition hover:border-[#21191b] sm:self-auto"
          disabled={loading}
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </button>
      </div>

      {loading ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3" aria-label="받은 관심 불러오는 중">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-[178px] animate-pulse rounded-2xl bg-[#f7f2f0]" />
          ))}
        </div>
      ) : items.length ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
          {items.map((profile) => (
            <ReceivedInterestCard
              key={profile.id}
              profile={profile}
              onOpen={() => onOpen(profile)}
              onLike={() => onLike(profile)}
              onPass={() => onPass(profile)}
            />
          ))}
        </div>
      ) : (
        <div className="px-5 py-8 text-center sm:px-6">
          <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-[#fff0f3] text-[#ea365d]">
            <Sparkles className="size-5" />
          </span>
          <p className="mt-3 text-sm font-extrabold text-[#33272a]">새로 온 관심은 여기에서 확인해요</p>
          <p className="mt-1 text-xs font-medium leading-5 text-[#8d7f80]">
            오늘의 추천에서 마음이 가는 사람에게 먼저 관심을 보내도 좋아요.
          </p>
        </div>
      )}
    </section>
  );
}

function ReceivedInterestCard({
  profile,
  onOpen,
  onLike,
  onPass,
}: {
  profile: ReceivedInterest;
  onOpen: () => void;
  onLike: () => void;
  onPass: () => void;
}) {
  const photo = profile.photos[0];
  const [busy, setBusy] = useState(false);

  async function respond(decision: "like" | "pass") {
    if (busy) return;
    setBusy(true);
    try {
      if (decision === "like") await onLike();
      else await onPass();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="grid min-w-0 grid-cols-[76px_minmax(0,1fr)] gap-3 rounded-2xl border border-[#eee5e3] bg-[#fffdfc] p-3">
      <button
        type="button"
        onClick={onOpen}
        disabled={busy}
        className="relative h-[152px] w-[76px] overflow-hidden rounded-xl bg-gradient-to-br from-[#e7b5aa] via-[#bb7b75] to-[#5c3938]"
        aria-label={`${profile.display_name}님 프로필 자세히 보기`}
      >
        {photo ? (
          <Image
            src={photo.url}
            alt={`${profile.display_name} 프로필 사진`}
            fill
            unoptimized
            sizes="76px"
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-4xl font-black text-white/35">
            {profile.display_name.slice(0, 1)}
          </span>
        )}
        <span className="absolute bottom-2 left-2 grid size-6 place-items-center rounded-full bg-white/90 text-[#287556] shadow-sm" title="안전한 프로필 정보">
          <ShieldCheck className="size-3.5" />
        </span>
      </button>
      <div className="flex min-w-0 flex-col py-0.5">
        <button type="button" onClick={onOpen} disabled={busy} className="min-w-0 text-left">
          <p className="truncate text-[15px] font-black tracking-[-.02em]">
            {profile.display_name} <span className="font-medium text-[#777]">{profile.age}</span>
          </p>
          <p className="mt-1 truncate text-xs font-medium text-[#777]">
            {profile.area} · {profile.job}
          </p>
        </button>
        <div className="mt-2 flex min-h-5 flex-wrap gap-1.5">
          {(profile.common_interests.length ? profile.common_interests : profile.interests).slice(0, 2).map((interest) => (
            <span key={interest} className="rounded-full bg-[#fff0f3] px-2 py-1 text-[10px] font-bold text-[#d8405e]">
              #{interest}
            </span>
          ))}
        </div>
        <p className="mt-2 truncate text-[10px] font-bold text-[#9b8688]">
          {likedDate(profile.liked_at)}에 관심을 보냈어요
        </p>
        <div className="mt-auto grid grid-cols-[1fr_54px] gap-2 pt-3">
          <button
            type="button"
            onClick={() => void respond("like")}
            disabled={busy}
            className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#ea365d] text-xs font-black text-white shadow-[0_8px_18px_rgba(234,54,93,.18)] transition hover:bg-[#d92e53]"
          >
            <Heart className="size-3.5 fill-current" /> 관심 보내기
          </button>
          <button
            type="button"
            onClick={() => void respond("pass")}
            disabled={busy}
            className="min-h-10 rounded-xl border border-[#e5d8d5] bg-white text-[11px] font-bold text-[#8d7f80] transition hover:border-[#21191b] hover:text-[#33272a]"
          >
            패스
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        disabled={busy}
        className="col-span-2 flex items-center justify-center gap-1 border-t border-[#f1e8e5] pt-2 text-[11px] font-extrabold text-[#6f6062]"
      >
        프로필 자세히 보기 <ArrowUpRight className="size-3.5" />
      </button>
    </article>
  );
}

