"use client";

import { Check, Copy, ShieldCheck, UserCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";

import {
  fetchReferralSummary,
  fetchVerificationStatus,
  redeemReferralCode,
  ReferralSummary,
  requestVerification,
  VerificationStatus,
} from "@/lib/api";

export function TrustGrowthCenter() {
  const [verification, setVerification] = useState<VerificationStatus | null>(null);
  const [referral, setReferral] = useState<ReferralSummary | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchVerificationStatus(), fetchReferralSummary()])
      .then(([verificationResult, referralResult]) => {
        if (!active) return;
        setVerification(verificationResult);
        setReferral(referralResult);
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "정보를 불러오지 못했어요");
      });
    return () => {
      active = false;
    };
  }, []);

  async function requestReview() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setVerification(await requestVerification());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "확인을 요청하지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!referral) return;
    await navigator.clipboard.writeText(referral.invite_url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function redeem() {
    if (busy || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setReferral(await redeemReferralCode(code));
      setCode("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "초대 코드를 등록하지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  const verificationCopy = verification?.verified
    ? "본인확인이 완료되어 프로필에 확인 배지가 표시돼요."
    : verification?.status === "pending"
      ? "운영팀이 소셜 계정과 프로필을 확인하고 있어요."
      : verification?.status === "rejected"
        ? verification.request?.note || "확인할 내용이 있어 다시 요청할 수 있어요."
      : "승인된 얼굴 프로필 사진과 소셜 계정을 운영팀이 함께 확인해요.";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-[#e5e5e5] bg-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black text-[#ff385c]">TRUST PROFILE</p>
            <h2 className="mt-1 text-lg font-black">본인확인</h2>
          </div>
          <span className={`grid size-10 place-items-center rounded-lg ${verification?.verified ? "bg-[#edf8f3] text-[#287556]" : "bg-[#f4f4f4] text-[#777]"}`}>
            {verification?.verified ? <Check className="size-5" /> : <UserCheck className="size-5" />}
          </span>
        </div>
        <p className="mt-4 min-h-10 text-sm font-medium leading-5 text-[#777]">
          {verificationCopy}
        </p>
        {!verification?.verified && verification?.status !== "pending" ? (
          <button
            type="button"
            onClick={requestReview}
            disabled={busy || !verification}
            className="mt-4 h-11 w-full rounded-lg bg-black text-sm font-black text-white disabled:opacity-40"
          >
            운영팀 확인 요청
          </button>
        ) : null}
      </section>

      <section className="rounded-xl border border-[#e5e5e5] bg-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black text-[#ff385c]">GROW TOGETHER</p>
            <h2 className="mt-1 text-lg font-black">친구 초대</h2>
          </div>
          <span className="grid size-10 place-items-center rounded-lg bg-[#fff0f3] text-[#ff385c]">
            <Users className="size-5" />
          </span>
        </div>
        {referral ? (
          <>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#f6f6f6] p-3">
              <code className="min-w-0 flex-1 truncate text-sm font-black">{referral.code}</code>
              <button type="button" onClick={copyInvite} className="grid size-8 place-items-center rounded-md bg-white" aria-label="초대 링크 복사">
                {copied ? <Check className="size-4 text-[#287556]" /> : <Copy className="size-4" />}
              </button>
            </div>
            <p className="mt-2 text-xs font-semibold text-[#888]">
              초대로 합류한 회원 {referral.invited_count}명
            </p>
            {!referral.redeemed ? (
              <div className="mt-4 flex gap-2">
                <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={12} placeholder="받은 초대 코드" className="morrow-input h-11 min-w-0" />
                <button type="button" onClick={redeem} disabled={busy || code.trim().length < 8} className="shrink-0 rounded-lg bg-black px-4 text-xs font-black text-white disabled:opacity-40">등록</button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-4 h-20 animate-pulse rounded-lg bg-[#f4f4f4]" />
        )}
      </section>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700 lg:col-span-2">
          {error}
        </p>
      ) : null}
      <p className="flex items-start gap-2 text-xs font-semibold leading-5 text-[#888] lg:col-span-2">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#287556]" />
        주민등록번호나 신분증 이미지는 받지 않습니다. 승인된 얼굴 프로필 사진이 1장 이상 있어야 요청할 수 있으며, 외부 본인인증 연동 전에는 수동 프로필 확인 배지로 운영합니다.
      </p>
    </div>
  );
}
