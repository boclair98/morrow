"use client";

import { Bell, CalendarDays, Check, Heart, MessageCircle, ShieldCheck } from "lucide-react";

import { NotificationItem } from "@/lib/api";


export function NotificationCenter({ items, loading, onReadAll, onSelect }: { items: NotificationItem[]; loading: boolean; onReadAll: () => void; onSelect: (item: NotificationItem) => void }) {
  const unread = items.filter((item) => !item.read_at).length;
  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div><p className="text-xs font-black text-[#ff385c]">ACTIVITY</p><h1 className="mt-1 text-3xl font-black tracking-[-.04em]">새로운 소식</h1><p className="mt-2 text-sm font-medium text-[#777]">매치, 메시지, 약속과 안전 처리 결과를 한곳에서 확인하세요.</p></div>
        {unread > 0 ? <button onClick={onReadAll} className="shrink-0 rounded-md border border-[#ddd] bg-white px-3 py-2 text-xs font-black"><Check className="mr-1 inline size-3.5" />모두 읽음</button> : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
        {loading ? <div className="p-10 text-center text-sm font-bold text-[#888]">알림을 불러오는 중…</div> : items.length ? items.map((item) => <button key={item.id} onClick={() => onSelect(item)} className={`flex w-full gap-4 border-b border-[#ededed] p-5 text-left last:border-b-0 ${item.read_at ? "bg-white" : "bg-[#fff8f9]"}`}><NotificationIcon kind={item.kind} /><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><strong className="text-sm font-black">{item.title}</strong>{!item.read_at ? <span className="mt-1 size-2 shrink-0 rounded-full bg-[#ff385c]" /> : null}</span><span className="mt-1.5 block text-sm font-medium leading-6 text-[#666]">{item.body}</span><span className="mt-2 block text-[11px] font-bold text-[#aaa]">{formatRelative(item.created_at)}</span></span></button>) : <div className="p-12 text-center"><Bell className="mx-auto size-8 text-[#bbb]" /><h2 className="mt-4 font-black">아직 새로운 소식이 없어요</h2><p className="mt-2 text-sm font-medium text-[#888]">중요한 변화만 정리해서 알려드릴게요.</p></div>}
      </div>
    </section>
  );
}


function NotificationIcon({ kind }: { kind: string }) {
  const Icon = kind === "match" ? Heart : kind === "message" ? MessageCircle : kind === "date" ? CalendarDays : ShieldCheck;
  return <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#f4f4f4] text-[#ff385c]"><Icon className="size-5" /></span>;
}


function formatRelative(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(elapsed / 60_000));
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(value));
}
