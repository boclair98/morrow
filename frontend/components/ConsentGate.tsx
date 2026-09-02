"use client";

import { Check, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";

import { saveConsents } from "@/lib/api";


export function ConsentGate() {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [adult, setAdult] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!terms || !privacy || !adult || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveConsents({
        terms_agreed: terms,
        privacy_agreed: privacy,
        adult_confirmed: adult,
        marketing_opt_in: marketing,
      });
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "동의 내용을 저장하지 못했어요");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f5f3] px-4 py-10 text-[#111]">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-[#e2e2e2] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,.06)] sm:p-9">
        <span className="grid size-12 place-items-center rounded-xl bg-[#ffe8ed] text-[#ff385c]"><ShieldCheck className="size-6" /></span>
        <p className="mt-6 text-xs font-black tracking-[.12em] text-[#ff385c]">ONE SAFE STEP</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-.04em]">안전한 만남을 위해<br />동의 내용을 확인해주세요.</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[#6f6f6f]">약관이 변경되면 기존 회원에게도 다시 확인을 요청합니다.</p>
        <div className="mt-7 divide-y divide-[#e8e8e8] border-y border-[#e8e8e8]">
          <ConsentRow checked={terms} onChange={setTerms} required label="이용약관 동의" href="/terms" />
          <ConsentRow checked={privacy} onChange={setPrivacy} required label="개인정보 처리방침 동의" href="/privacy" />
          <ConsentRow checked={adult} onChange={setAdult} required label="만 20세 이상입니다" />
          <ConsentRow checked={marketing} onChange={setMarketing} label="새 매치와 이벤트 소식 수신" />
        </div>
        {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
        <button disabled={!terms || !privacy || !adult || busy} className="mt-6 h-13 w-full rounded-lg bg-black text-sm font-black text-white disabled:opacity-35">
          {busy ? "저장 중…" : "확인하고 계속하기"}
        </button>
      </form>
    </main>
  );
}


function ConsentRow({ checked, onChange, label, required = false, href }: { checked: boolean; onChange: (checked: boolean) => void; label: string; required?: boolean; href?: string }) {
  return (
    <div className="flex items-center gap-3 py-4">
      <button type="button" onClick={() => onChange(!checked)} aria-pressed={checked} className={`grid size-6 shrink-0 place-items-center rounded-md border ${checked ? "border-black bg-black text-white" : "border-[#ccc] bg-white"}`}>
        {checked ? <Check className="size-4" /> : null}
      </button>
      <button type="button" onClick={() => onChange(!checked)} className="flex-1 text-left text-sm font-bold"><span className={required ? "text-[#ff385c]" : "text-[#888]"}>{required ? "[필수]" : "[선택]"}</span> {label}</button>
      {href ? <a href={href} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#777] underline underline-offset-4">보기</a> : null}
    </div>
  );
}
