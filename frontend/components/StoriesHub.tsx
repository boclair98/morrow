"use client";

import {
  Camera,
  Check,
  Clock3,
  Heart,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

import { compressImage } from "@/components/ProfilePhotos";
import {
  createStory,
  deleteStory,
  fetchStories,
  StoryItem,
  toggleStoryReaction,
} from "@/lib/api";

const prompts = [
  "오늘 가장 마음에 들었던 순간은?",
  "이번 주말에 같이 하고 싶은 건?",
  "요즘 자주 가는 동네 카페는?",
  "첫 데이트는 카페와 산책 중 뭐가 좋아요?",
];

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return "오늘";
}

export function StoriesHub({
  displayName,
  onNotice,
}: {
  displayName: string;
  onNotice?: (message: string) => void;
}) {
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setStories((await fetchStories()).items);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "스토리를 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchStories()
      .then((result) => {
        if (active) {
          setStories(result.items);
          setError(null);
        }
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "스토리를 불러오지 못했어요");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const myStory = useMemo(() => stories.find((story) => story.mine), [stories]);
  const peopleStories = useMemo(() => stories.filter((story) => !story.mine), [stories]);

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setPhoto(await compressImage(file));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "사진을 준비하지 못했어요");
    }
  }

  async function publish() {
    if (busy || (!body.trim() && !photo)) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createStory(body.trim(), photo || undefined);
      setStories((current) => [created.item, ...current.filter((item) => item.id !== created.item.id)]);
      setBody("");
      setPhoto(null);
      setComposerOpen(false);
      onNotice?.("오늘의 스토리를 올렸어요");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "스토리를 올리지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  async function react(story: StoryItem) {
    try {
      const result = await toggleStoryReaction(story.id);
      setStories((current) => current.map((item) => item.id === story.id ? { ...item, reacted: result.reacted, reaction_count: result.reaction_count } : item));
    } catch (cause) {
      onNotice?.(cause instanceof Error ? cause.message : "반응을 저장하지 못했어요");
    }
  }

  async function remove(story: StoryItem) {
    if (!window.confirm("오늘의 스토리를 삭제할까요?")) return;
    try {
      await deleteStory(story.id);
      setStories((current) => current.filter((item) => item.id !== story.id));
      onNotice?.("스토리를 삭제했어요");
    } catch (cause) {
      onNotice?.(cause instanceof Error ? cause.message : "스토리를 삭제하지 못했어요");
    }
  }

  return (
    <section className="mb-7 overflow-hidden rounded-[26px] border border-[#f0dfdb] bg-white shadow-[0_18px_50px_rgba(86,49,59,.06)]">
      <div className="flex flex-col gap-4 border-b border-[#f2e9e7] bg-gradient-to-r from-[#fff6f1] via-white to-[#f9f3ff] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black tracking-[.14em] text-[#ea365d]">
            <Sparkles className="size-3.5" /> TODAY&apos;S STORIES
          </div>
          <h2 className="mt-2 text-xl font-black tracking-[-.03em]">오늘의 마음을 가볍게 남겨보세요</h2>
          <p className="mt-1 text-sm font-medium text-[#857477]">24시간 동안만 공개돼서, 프로필보다 자연스럽게 시작할 수 있어요.</p>
        </div>
        <div className="flex gap-2"><button type="button" onClick={() => void load()} className="grid size-11 place-items-center rounded-xl border border-[#e8dcd9] bg-white text-[#7d6d71]" aria-label="스토리 새로고침"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></button><button type="button" onClick={() => setComposerOpen((open) => !open)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#21191b] px-4 text-sm font-black text-white transition hover:bg-[#ea365d]">
          <Plus className="size-4" /> 내 스토리 올리기
        </button></div>
      </div>

      {composerOpen ? (
        <div className="border-b border-[#f2e9e7] bg-[#fffaf8] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs font-black text-[#ea365d]">MORROW MOMENT</p><p className="mt-1 text-sm font-black">{displayName}님의 오늘</p></div>
            <button type="button" onClick={() => { setComposerOpen(false); setBody(""); setPhoto(null); }} className="grid size-9 place-items-center rounded-full bg-white text-[#8f8180]" aria-label="스토리 작성 닫기"><X className="size-4" /></button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {prompts.map((prompt) => <button type="button" key={prompt} onClick={() => setBody(prompt)} className="rounded-full border border-[#eadad7] bg-white px-3 py-2 text-xs font-bold text-[#6e5e62] hover:border-[#ea365d] hover:text-[#ea365d]">{prompt}</button>)}
          </div>
          <textarea value={body} onChange={(event) => setBody(event.target.value.slice(0, 240))} placeholder="오늘의 분위기나 같이 하고 싶은 일을 적어보세요" className="mt-4 min-h-24 w-full resize-none rounded-2xl border border-[#eadedb] bg-white p-4 text-sm font-medium outline-none focus:border-[#ea365d]" />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#e4d7d4] bg-white px-3 text-xs font-black text-[#6e5e62] hover:border-[#ea365d]">
              <Camera className="size-4" /> 사진 추가
              <input type="file" accept="image/*" className="sr-only" onChange={choosePhoto} />
            </label>
            {photo ? <span className="inline-flex items-center gap-2 rounded-xl bg-[#edf8f3] px-3 py-2 text-xs font-black text-[#287556]"><Check className="size-3.5" /> 사진 준비 완료</span> : null}
            <button type="button" onClick={publish} disabled={busy || (!body.trim() && !photo)} className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#ea365d] px-4 text-xs font-black text-white disabled:opacity-40"><Send className="size-3.5" /> {busy ? "올리는 중..." : "스토리 게시"}</button>
          </div>
          {error ? <p role="alert" className="mt-3 text-xs font-bold text-[#c5374e]">{error}</p> : null}
        </div>
      ) : null}

      <div className="flex gap-3 overflow-x-auto p-5 sm:p-6">
        <button type="button" onClick={() => setComposerOpen(true)} className="group flex w-[112px] shrink-0 flex-col items-center gap-2 text-center">
          <span className="relative grid size-[74px] place-items-center rounded-full border-2 border-dashed border-[#f09aad] bg-[#fff0f3] text-[#ea365d] transition group-hover:scale-105"><Plus className="size-6" />{myStory ? <span className="absolute -bottom-1 rounded-full bg-[#21191b] px-2 py-1 text-[9px] font-black text-white">내 스토리</span> : null}</span>
          <span className="truncate text-xs font-black">{myStory ? "오늘 업데이트" : "첫 스토리"}</span>
        </button>
        {loading ? <div className="flex items-center gap-3"><span className="size-[74px] animate-pulse rounded-full bg-[#f5e9e7]" /><span className="size-[74px] animate-pulse rounded-full bg-[#f5e9e7]" /></div> : null}
        {!loading && myStory ? (
          <article className="w-[150px] shrink-0 overflow-hidden rounded-2xl border border-[#f0cbd4] bg-[#fff7f8] shadow-sm">
            <div className="relative h-28 bg-gradient-to-br from-[#ffcad4] to-[#f1d9f3]">
              {myStory.photo_url ? <Image src={myStory.photo_url} alt="내 스토리" fill unoptimized sizes="150px" className="object-cover" /> : <div className="flex h-full items-end p-3"><p className="line-clamp-3 text-xs font-black leading-5 text-[#5b444b]">{myStory.body}</p></div>}
              <span className="absolute left-2 top-2 rounded-full bg-[#21191b] px-2 py-1 text-[9px] font-black text-white">내 스토리</span>
            </div>
            <div className="flex items-center justify-between gap-2 p-3"><span className="flex items-center gap-1 text-[10px] font-semibold text-[#9a898d]"><Clock3 className="size-3" /> {relativeTime(myStory.created_at)}</span><button type="button" onClick={() => void remove(myStory)} className="grid size-7 place-items-center rounded-full bg-white text-[#9e7d84]" aria-label="내 스토리 삭제"><Trash2 className="size-3.5" /></button></div>
          </article>
        ) : null}
        {!loading && peopleStories.map((story) => (
          <article key={story.id} className="w-[150px] shrink-0 overflow-hidden rounded-2xl border border-[#eee2df] bg-[#fffdfc] shadow-sm">
            <div className="relative h-28 bg-gradient-to-br from-[#fbe4df] to-[#efe5fa]">
              {story.photo_url ? <Image src={story.photo_url} alt="" fill unoptimized sizes="150px" className="object-cover" /> : <div className="flex h-full items-end p-3"><p className="line-clamp-3 text-xs font-black leading-5 text-[#5b444b]">{story.body}</p></div>}
              <span className="absolute left-2 top-2 grid size-8 place-items-center overflow-hidden rounded-full border-2 border-white bg-[#e6c7c4] text-[10px] font-black text-white">{story.author.avatar_url ? <Image src={story.author.avatar_url} alt="" fill unoptimized sizes="32px" className="object-cover" /> : story.author.display_name.slice(0, 1)}</span>
            </div>
            <div className="p-3"><p className="truncate text-xs font-black">{story.author.display_name}{story.author.account_verified ? <Check className="ml-1 inline size-3 text-[#287556]" /> : null}</p><p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[#9a898d]"><Clock3 className="size-3" /> {relativeTime(story.created_at)}</p><button type="button" onClick={() => void react(story)} className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${story.reacted ? "bg-[#fff0f3] text-[#ea365d]" : "bg-[#f7f1ef] text-[#806f72]"}`}><Heart className={`size-3 ${story.reacted ? "fill-current" : ""}`} /> {story.reaction_count || "마음"}</button></div>
          </article>
        ))}
        {!loading && peopleStories.length === 0 ? <div className="flex min-h-[112px] min-w-[260px] items-center gap-3 rounded-2xl bg-[#faf6f4] px-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#ea365d]"><ImageIcon className="size-5" /></span><p className="text-xs font-bold leading-5 text-[#88777b]">아직 주변의 오늘이 없어요.<br />첫 스토리를 올리면 대화가 시작될 수 있어요.</p></div> : null}
      </div>
    </section>
  );
}
