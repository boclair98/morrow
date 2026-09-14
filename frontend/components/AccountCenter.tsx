"use client";

import { Download, Eye, EyeOff, ShieldCheck, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { SignOutLink } from "@/components/SignIn";
import { TrustGrowthCenter } from "@/components/TrustGrowthCenter";
import { AccountSettings, deleteAccount, downloadAccountData, fetchAccountSettings, signOut, updateAccountSettings } from "@/lib/api";
import { DISTANCE_OPTIONS } from "@/lib/dating-options";

const AdminConsole = dynamic(() => import("@/components/AdminConsole").then((module) => module.AdminConsole));

export function AccountCenter({ isAdmin }: { isAdmin: boolean }) {
  const [settings, setSettings] = useState<AccountSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAccountSettings().then((item) => { if (active) setSettings(item); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "설정을 불러오지 못했어요"); });
    return () => { active = false; };
  }, []);

  async function change(key: "discoverable" | "marketing_opt_in" | "notify_matches" | "notify_messages" | "notify_dates", value: boolean) {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, [key]: value });
    setError(null);
    try {
      const result = await updateAccountSettings({ [key]: value });
      setSettings(result.settings);
    } catch (cause) {
      setSettings(previous);
      setError(cause instanceof Error ? cause.message : "설정을 저장하지 못했어요");
    }
  }

  async function savePreferences() {
    if (!settings || busy) return;
    if (settings.min_preferred_age > settings.max_preferred_age) {
      setError("선호 최소 나이는 최대 나이보다 높을 수 없어요");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await updateAccountSettings({
        min_preferred_age: settings.min_preferred_age,
        max_preferred_age: settings.max_preferred_age,
        max_distance_km: settings.max_distance_km,
      });
      setSettings(result.settings);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "추천 조건을 저장하지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  async function exportData() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try { await downloadAccountData(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "데이터를 내려받지 못했어요"); }
    finally { setBusy(false); }
  }

  async function removeAccount() {
    const first = window.confirm("프로필, 사진, 매치와 메시지가 모두 삭제됩니다. 계속할까요?");
    if (!first) return;
    const confirmation = window.prompt('확인을 위해 "MORROW 탈퇴"를 입력해주세요.');
    if (confirmation !== "MORROW 탈퇴") return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      await signOut();
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "계정을 삭제하지 못했어요");
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <TrustGrowthCenter />
      <section className="rounded-xl border border-[#e5e5e5] bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black text-[#ff385c]">PROFILE VISIBILITY</p><h2 className="mt-1 text-lg font-black">추천 노출</h2><p className="mt-1 text-sm font-medium text-[#777]">잠시 쉬고 싶을 때 기존 매치와 대화는 유지한 채 추천만 멈출 수 있어요.</p></div>{settings ? <Toggle checked={settings.discoverable} onChange={(checked) => change("discoverable", checked)} label="추천 노출" /> : null}</div>
        {settings ? <div className={`mt-5 flex items-center gap-3 rounded-lg p-4 text-sm font-bold ${settings.discoverable ? "bg-[#edf8f3] text-[#287556]" : "bg-[#f4f4f4] text-[#666]"}`}>{settings.discoverable ? <Eye className="size-5" /> : <EyeOff className="size-5" />}{settings.discoverable ? "현재 실제 회원 추천에 표시되고 있어요." : "새로운 추천에서 내 프로필이 숨겨졌어요."}</div> : <div className="mt-5 h-14 animate-pulse rounded-lg bg-[#f4f4f4]" />}
      </section>

      <section className="rounded-xl border border-[#e5e5e5] bg-white p-5 sm:p-6">
        <p className="text-xs font-black text-[#ff385c]">MATCH PREFERENCES</p>
        <h2 className="mt-1 text-lg font-black">추천 조건</h2>
        <p className="mt-1 text-sm font-medium text-[#777]">서로의 나이 조건과 활동 지역 거리가 맞는 사람만 추천해요.</p>
        {settings ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <PreferenceNumber
              label="최소 나이"
              value={settings.min_preferred_age}
              onChange={(value) => setSettings({ ...settings, min_preferred_age: value })}
            />
            <PreferenceNumber
              label="최대 나이"
              value={settings.max_preferred_age}
              onChange={(value) => setSettings({ ...settings, max_preferred_age: value })}
            />
            <label className="text-xs font-black text-[#555]">
              추천 거리
              <select
                value={settings.max_distance_km}
                onChange={(event) => setSettings({ ...settings, max_distance_km: Number(event.target.value) })}
                className="morrow-input mt-2"
              >
                {DISTANCE_OPTIONS.map((distance) => (
                  <option key={distance} value={distance}>{distance}km 이내</option>
                ))}
              </select>
            </label>
            <button
              onClick={savePreferences}
              disabled={busy}
              className="h-11 rounded-lg bg-black text-sm font-black text-white disabled:opacity-50 sm:col-span-3"
            >
              추천 조건 저장
            </button>
          </div>
        ) : <div className="mt-5 h-28 animate-pulse rounded-lg bg-[#f4f4f4]" />}
      </section>

      <section className="rounded-xl border border-[#e5e5e5] bg-white p-5 sm:p-6">
        <p className="text-xs font-black text-[#ff385c]">NOTIFICATIONS</p><h2 className="mt-1 text-lg font-black">알림 설정</h2>
        <div className="mt-4 divide-y divide-[#ededed]">{settings ? <><SettingRow title="새로운 매치" body="서로 관심이 이어졌을 때" checked={settings.notify_matches} onChange={(checked) => change("notify_matches", checked)} /><SettingRow title="새 메시지" body="매치 상대가 대화를 보냈을 때" checked={settings.notify_messages} onChange={(checked) => change("notify_messages", checked)} /><SettingRow title="약속 제안과 답변" body="새 약속이 오거나 응답이 도착했을 때" checked={settings.notify_dates} onChange={(checked) => change("notify_dates", checked)} /><SettingRow title="마케팅 정보" body="이벤트와 서비스 소식·선택 동의" checked={settings.marketing_opt_in} onChange={(checked) => change("marketing_opt_in", checked)} /></> : <div className="h-40 animate-pulse bg-[#f5f5f5]" />}</div>
      </section>

      <section className="rounded-xl border border-[#e5e5e5] bg-white p-5 sm:p-6">
        <p className="text-xs font-black text-[#ff385c]">PRIVACY & ACCOUNT</p><h2 className="mt-1 text-lg font-black">개인정보와 계정</h2>
        <div className="mt-5 grid gap-2 sm:grid-cols-2"><a href="/privacy" className="rounded-lg border border-[#ddd] p-4 text-sm font-black hover:border-black"><ShieldCheck className="mb-3 size-5 text-[#ff385c]" />개인정보 처리방침</a><button onClick={exportData} disabled={busy} className="rounded-lg border border-[#ddd] p-4 text-left text-sm font-black hover:border-black disabled:opacity-50"><Download className="mb-3 size-5 text-[#ff385c]" />내 데이터 내려받기</button><a href="/terms" className="rounded-lg border border-[#ddd] p-4 text-sm font-black hover:border-black">이용약관 보기</a><a href="/community-guidelines" className="rounded-lg border border-[#ddd] p-4 text-sm font-black hover:border-black">커뮤니티 가이드</a></div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#eee] pt-5"><SignOutLink returnTo="/" /><button onClick={removeAccount} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 disabled:opacity-50"><Trash2 className="size-3.5" />계정 영구 삭제</button></div>
        {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
      </section>
      {isAdmin ? <AdminConsole /> : null}
    </div>
  );
}

function PreferenceNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="text-xs font-black text-[#555]">{label}<input type="number" min={20} max={49} value={value} onChange={(event) => onChange(Number(event.target.value))} className="morrow-input mt-2" /></label>;
}


function SettingRow({ title, body, checked, onChange }: { title: string; body: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-black">{title}</p><p className="mt-1 text-xs font-medium text-[#888]">{body}</p></div><Toggle checked={checked} onChange={onChange} label={title} /></div>;
}


function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-black" : "bg-[#d0d0d0]"}`}><span className={`absolute top-1 size-5 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} /></button>;
}

