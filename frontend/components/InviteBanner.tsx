"use client";

import { Check, Copy, Gift, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchReferralSummary, type ReferralSummary } from "@/lib/api";

export function InviteBanner({ onNotice }: { onNotice?: (message: string) => void }) {
  const [referral, setReferral] = useState<ReferralSummary | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetchReferralSummary().then((result) => { if (active) setReferral(result); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function copy() {
    if (!referral) return;
    try {
      await navigator.clipboard.writeText(referral.invite_url);
      setCopied(true);
      onNotice?.("초대 링크를 복사했어요");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onNotice?.("링크를 복사하지 못했어요. 프로필에서 다시 시도해주세요");
    }
  }

  if (!referral) return null;
  return (
    <section className="mb-7 flex flex-col gap-4 overflow-hidden rounded-[24px] border border-[#f0dfdb] bg-gradient-to-r from-[#fff1ec] via-[#fff9f7] to-[#f7f0ff] p-5 shadow-[0_14px_38px_rgba(90,50,60,.06)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#ea365d] text-white"><Gift className="size-5" /></span><div><p className="text-[10px] font-black tracking-[.14em] text-[#ea365d]">GROW TOGETHER</p><h2 className="mt-1 text-lg font-black">친구와 함께 오늘의 연결을 채워요</h2><p className="mt-1 text-xs font-medium text-[#88777b]">초대한 친구 {referral.invited_count}명 · 링크를 공유하면 새로운 사람이 합류해요.</p></div></div>
      <button type="button" onClick={() => void copy()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#21191b] px-4 text-xs font-black text-white transition hover:bg-[#ea365d]">{copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "복사했어요" : "초대 링크 복사"}<Users className="ml-1 size-3.5 opacity-60" /></button>
    </section>
  );
}
