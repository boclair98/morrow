"use client";

import Image from "next/image";
import { Check, ShieldAlert, UserCheck, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AdminOverview, AdminPhoto, AdminReport, AdminVerification, fetchAdminOverview, fetchAdminPhotos, fetchAdminReports, fetchAdminVerifications, moderateAdminPhoto, resolveAdminReport, reviewAdminVerification } from "@/lib/api";


export function AdminConsole() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [verifications, setVerifications] = useState<AdminVerification[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [overviewResult, reportResult, photoResult, verificationResult] = await Promise.all([
        fetchAdminOverview(), fetchAdminReports(), fetchAdminPhotos(), fetchAdminVerifications(),
      ]);
      setOverview(overviewResult);
      setReports(reportResult.items);
      setPhotos(photoResult.items);
      setVerifications(verificationResult.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "운영 대시보드를 불러오지 못했어요");
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([fetchAdminOverview(), fetchAdminReports(), fetchAdminPhotos(), fetchAdminVerifications()])
      .then(([overviewResult, reportResult, photoResult, verificationResult]) => {
        if (!active) return;
        setOverview(overviewResult);
        setReports(reportResult.items);
        setPhotos(photoResult.items);
        setVerifications(verificationResult.items);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "운영 대시보드를 불러오지 못했어요");
      });
    return () => { active = false; };
  }, []);

  async function resolve(report: AdminReport, resolution: "dismiss" | "warn" | "suspend_7d" | "ban") {
    if (busyId) return;
    const highImpact = resolution === "suspend_7d" || resolution === "ban";
    if (highImpact && !window.confirm(`${report.reported_name} 계정에 제재를 적용할까요?`)) return;
    setBusyId(report.id);
    setError(null);
    try { await resolveAdminReport(report.id, resolution); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "신고를 처리하지 못했어요"); }
    finally { setBusyId(null); }
  }

  async function moderate(photo: AdminPhoto, decision: "approved" | "rejected") {
    if (busyId) return;
    setBusyId(photo.id);
    try { await moderateAdminPhoto(photo.id, decision); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "사진을 처리하지 못했어요"); }
    finally { setBusyId(null); }
  }

  async function reviewVerification(item: AdminVerification, decision: "approved" | "rejected") {
    if (busyId) return;
    const note = decision === "rejected" ? window.prompt("회원에게 안내할 보류 사유를 입력해주세요.") || "" : "";
    if (decision === "rejected" && !note) return;
    setBusyId(item.id);
    setError(null);
    try { await reviewAdminVerification(item.id, decision, note); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "본인확인 요청을 처리하지 못했어요"); }
    finally { setBusyId(null); }
  }

  return (
    <section className="rounded-xl border-2 border-black bg-white p-5 sm:p-6">
      <p className="text-xs font-black text-[#ff385c]">ADMIN ONLY</p><h2 className="mt-1 text-xl font-black">안전 운영 콘솔</h2><p className="mt-1 text-sm font-medium text-[#777]">서버에서 지정한 운영자 계정만 이 화면과 API에 접근할 수 있습니다.</p>
      {overview ? <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-[#ddd] lg:grid-cols-5">{[["전체 회원",overview.users],["대기 신고",overview.pending_reports],["검수 사진",overview.pending_photos],["본인확인",overview.pending_verifications],["제한 계정",overview.restricted_users]].map(([label,value]) => <div key={label} className="bg-[#f7f7f7] p-4"><p className="text-xs font-bold text-[#777]">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>)}</div> : null}
      <div className="mt-6"><h3 className="flex items-center gap-2 font-black"><UserCheck className="size-4 text-[#ff385c]" />본인확인 대기열</h3>{verifications.length ? <div className="mt-3 space-y-3">{verifications.map((item) => <article key={item.id} className="rounded-lg border border-[#ddd] p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3">{item.photo_url ? <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-[#eee]"><Image src={item.photo_url} alt={`${item.display_name} 확인 사진`} fill unoptimized sizes="64px" className="object-cover" /></div> : null}<div><p className="font-black">{item.display_name} <span className="text-xs text-[#888]">{item.age}세 · {item.area}</span></p><p className="mt-1 text-xs font-semibold text-[#777]">연결 계정: {item.social_providers.join(", ") || "확인 필요"}</p></div></div><span className="rounded bg-[#fff0f3] px-2 py-1 text-[10px] font-black text-[#ff385c]">대기</span></div>{item.note ? <p className="mt-3 rounded bg-[#f7f7f7] p-3 text-xs font-medium">{item.note}</p> : null}<div className="mt-3 grid grid-cols-2 gap-2"><button disabled={busyId === item.id} onClick={() => reviewVerification(item,"rejected")} className="rounded-md border border-[#ccc] py-2 text-xs font-black disabled:opacity-40">보류</button><button disabled={busyId === item.id} onClick={() => reviewVerification(item,"approved")} className="rounded-md bg-black py-2 text-xs font-black text-white disabled:opacity-40">프로필 확인 완료</button></div></article>)}</div> : <p className="mt-3 rounded-lg bg-[#f7f7f7] p-5 text-sm font-bold text-[#777]">대기 중인 본인확인 요청이 없습니다.</p>}</div>
      <div className="mt-6"><h3 className="flex items-center gap-2 font-black"><ShieldAlert className="size-4 text-[#ff385c]" />신고 대기열</h3>{reports.length ? <div className="mt-3 space-y-3">{reports.map((report) => <article key={report.id} className="rounded-lg border border-[#ddd] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{report.reported_name} <span className="text-xs text-[#888]">신고자 {report.reporter_name}</span></p><p className="mt-1 text-xs font-bold text-[#ff385c]">{report.category} · {report.priority}</p></div><span className="rounded bg-[#f2f2f2] px-2 py-1 text-[10px] font-black">{report.reported_status}</span></div><p className="mt-3 rounded bg-[#f7f7f7] p-3 text-sm font-medium text-[#555]">{report.detail || "상세 내용 없음"}</p><div className="mt-3 flex flex-wrap gap-2"><Action disabled={busyId === report.id} onClick={() => resolve(report,"dismiss")}>기각</Action><Action disabled={busyId === report.id} onClick={() => resolve(report,"warn")}>경고</Action><Action disabled={busyId === report.id} onClick={() => resolve(report,"suspend_7d")}>7일 정지</Action><Action danger disabled={busyId === report.id} onClick={() => resolve(report,"ban")}>영구 제한</Action></div></article>)}</div> : <p className="mt-3 rounded-lg bg-[#f7f7f7] p-5 text-sm font-bold text-[#777]">대기 중인 신고가 없습니다.</p>}</div>
      <div className="mt-6"><h3 className="flex items-center gap-2 font-black"><Users className="size-4 text-[#ff385c]" />사진 검수</h3>{photos.length ? <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((photo) => <article key={photo.id} className="overflow-hidden rounded-lg border border-[#ddd]"><div className="relative aspect-[3/4] bg-[#eee]"><Image src={photo.url} alt={`${photo.owner_name} 검수 사진`} fill unoptimized sizes="(max-width: 640px) 50vw, 220px" className="object-cover" /></div><div className="p-3"><p className="truncate text-xs font-black">{photo.owner_name}</p><div className="mt-2 grid grid-cols-2 gap-1"><button disabled={busyId === photo.id} onClick={() => moderate(photo,"approved")} className="grid h-8 place-items-center rounded bg-black text-white" aria-label="승인"><Check className="size-4" /></button><button disabled={busyId === photo.id} onClick={() => moderate(photo,"rejected")} className="grid h-8 place-items-center rounded bg-red-50 text-red-600" aria-label="거절"><X className="size-4" /></button></div></div></article>)}</div> : <p className="mt-3 rounded-lg bg-[#f7f7f7] p-5 text-sm font-bold text-[#777]">검수 대기 사진이 없습니다.</p>}</div>
      {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
    </section>
  );
}


function Action({ children, onClick, disabled, danger = false }: { children: React.ReactNode; onClick: () => void; disabled: boolean; danger?: boolean }) {
  return <button disabled={disabled} onClick={onClick} className={`rounded-md px-3 py-2 text-xs font-black disabled:opacity-40 ${danger ? "bg-red-600 text-white" : "border border-[#ccc] bg-white"}`}>{children}</button>;
}
