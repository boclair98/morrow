"use client";

import { Bookmark, Check, Clock3, Heart, MapPin, RefreshCw, Users } from "lucide-react";
import Image from "next/image";

import type { Footprint } from "@/lib/api";

function viewedLabel(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "방금 프로필을 봤어요";
  if (minutes < 60) return `${minutes}분 전에 프로필을 봤어요`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전에 프로필을 봤어요`;
  return "최근 30일 안에 봤어요";
}

export function FootprintsView({
  items,
  loading,
  mode,
  onModeChange,
  onRefresh,
  onLike,
  onSave,
}: {
  items: Footprint[];
  loading: boolean;
  mode: "incoming" | "outgoing";
  onModeChange: (mode: "incoming" | "outgoing") => void;
  onRefresh: () => void;
  onLike: (item: Footprint) => void;
  onSave: (item: Footprint) => void;
}) {
  return (
    <section className="mx-auto max-w-[1100px]">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-black tracking-[.14em] text-[#ea365d]">RECENT FOOTPRINTS</p><h1 className="mt-1 text-3xl font-black tracking-[-.04em]">내 프로필을 본 사람</h1><p className="mt-2 text-sm font-medium text-[#817276]">서로의 오늘이 겹친 사람에게 먼저 가볍게 인사를 건네보세요.</p></div>
        <div className="flex items-center gap-2"><div className="flex rounded-full bg-[#f7f1ef] p-1"><button type="button" onClick={() => onModeChange("incoming")} className={`rounded-full px-3 py-2 text-xs font-black ${mode === "incoming" ? "bg-white text-[#ea365d] shadow-sm" : "text-[#8d7b7f]"}`}>나를 본 사람</button><button type="button" onClick={() => onModeChange("outgoing")} className={`rounded-full px-3 py-2 text-xs font-black ${mode === "outgoing" ? "bg-white text-[#ea365d] shadow-sm" : "text-[#8d7b7f]"}`}>내가 본 사람</button></div><button type="button" onClick={onRefresh} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#e5d8d5] bg-white px-4 text-xs font-black"><RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> 새로고침</button></div>
      </div>
      {loading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-52 animate-pulse rounded-[22px] bg-[#f5edeb]" />)}</div> : items.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} className="rounded-[22px] border border-[#eee4e1] bg-white p-4 shadow-[0_10px_30px_rgba(72,45,52,.04)]"><div className="flex items-center gap-3"><span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#e9c3bd] to-[#7e5964] text-xl font-black text-white">{item.photos[0] ? <Image src={item.photos[0].url} alt="" fill unoptimized sizes="56px" className="object-cover" /> : item.display_name.slice(0, 1)}</span><div className="min-w-0"><p className="truncate font-black">{item.display_name} <span className="font-semibold text-[#817276]">{item.age}</span>{item.account_verified ? <Check className="ml-1 inline size-3.5 text-[#287556]" /> : null}</p><p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#8e7d81]"><MapPin className="size-3" /> {item.area} · {item.job}</p><p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[#ea365d]"><Clock3 className="size-3" /> {viewedLabel(item.viewed_at)}</p></div></div><div className="mt-4 flex flex-wrap gap-1.5">{item.match_reasons.slice(0, 2).map((reason) => <span key={reason} className="rounded-full bg-[#fff3f4] px-2.5 py-1 text-[10px] font-black text-[#d8405e]">{reason}</span>)}</div><p className="mt-3 line-clamp-2 text-xs font-medium leading-5 text-[#75676a]">{item.bio}</p><div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2"><button type="button" onClick={() => onLike(item)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#ea365d] text-xs font-black text-white"><Heart className="size-3.5" /> 관심 보내기</button><button type="button" onClick={() => onSave(item)} className="grid size-10 place-items-center rounded-xl border border-[#e8dcd9] text-[#7c6b6e]" aria-label="프로필 저장"><Bookmark className={`size-4 ${item.saved ? "fill-current text-[#ea365d]" : ""}`} /></button><span className="grid size-10 place-items-center rounded-xl bg-[#faf4f2] text-xs font-black text-[#ea365d]">{item.compatibility}%</span></div></article>)}</div> : <div className="grid min-h-[360px] place-items-center rounded-[26px] border border-dashed border-[#ded2ce] bg-white p-8 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff0f3] text-[#ea365d]"><Users className="size-7" /></span><h2 className="mt-5 text-xl font-black">아직 새로운 발자국이 없어요</h2><p className="mt-2 text-sm font-medium leading-6 text-[#87777a]">오늘의 추천과 스토리를 먼저 채워두면<br />서로의 발자국이 자연스럽게 쌓여요.</p><button type="button" onClick={onRefresh} className="mt-5 min-h-11 rounded-xl bg-[#21191b] px-5 text-sm font-black text-white">다시 확인</button></div></div>}
    </section>
  );
}
