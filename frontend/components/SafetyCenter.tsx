"use client";

import { AlertTriangle, ExternalLink, MapPin, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchMyReports, MyReport } from "@/lib/api";


const safetyCards = [
  [ShieldCheck, "연락처는 천천히", "충분히 대화하기 전에는 전화번호, SNS, 회사 등 개인 정보를 공유하지 마세요."],
  [MapPin, "첫 만남은 공개 장소에서", "사람이 많은 카페나 식당에서 만나고, 지인에게 약속 시간과 장소를 알려주세요."],
  [AlertTriangle, "금전 요구는 즉시 신고", "송금, 투자, 코인, 인증번호를 요구하면 대화를 중단하고 신고해주세요."],
  [Users, "불편하면 바로 종료", "설명할 의무는 없어요. 차단하면 서로의 프로필과 대화 접근이 즉시 중단됩니다."],
] as const;


export function SafetyCenter() {
  const [reports, setReports] = useState<MyReport[]>([]);
  useEffect(() => {
    let active = true;
    fetchMyReports().then((result) => { if (active) setReports(result.items); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  return <section className="mx-auto max-w-4xl"><div className="mb-7"><p className="text-sm font-black text-[#ff385c]">SAFETY FIRST</p><h1 className="mt-1 text-3xl font-black tracking-[-.04em]">안전한 만남을 위한 약속</h1><p className="mt-2 text-sm font-medium text-[#777]">프로필 확인부터 실제 약속까지 안전 기능을 언제든 사용할 수 있어요.</p></div><div className="grid gap-4 md:grid-cols-2">{safetyCards.map(([Icon,title,body]) => <article key={title} className="rounded-xl border border-[#e5e5e5] bg-white p-6"><span className="grid size-11 place-items-center rounded-lg bg-[#ffe8ed] text-[#ff385c]"><Icon className="size-5" /></span><h2 className="mt-5 text-lg font-black">{title}</h2><p className="mt-2 text-sm font-medium leading-6 text-[#777]">{body}</p></article>)}</div><div className="mt-5 rounded-xl bg-black p-6 text-white sm:p-8"><h2 className="text-xl font-black">위험하거나 불쾌한 일을 겪었나요?</h2><p className="mt-2 text-sm font-medium text-white/60">추천 프로필과 매치 대화의 메뉴에서 신고·차단할 수 있습니다. 긴급한 위험은 앱 신고와 별개로 경찰 112에 연락하세요.</p><a href="/community-guidelines" className="mt-5 inline-flex items-center gap-1 text-sm font-black text-[#ff8aa0]">커뮤니티 가이드 확인 <ExternalLink className="size-3.5" /></a></div>{reports.length ? <section className="mt-5 rounded-xl border border-[#e5e5e5] bg-white p-5 sm:p-6"><h2 className="font-black">내 신고 처리 현황</h2><div className="mt-4 divide-y divide-[#ededed]">{reports.map((report) => <div key={report.id} className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-black">{categoryLabel(report.category)}</p><p className="mt-1 text-xs font-medium text-[#888]">{new Intl.DateTimeFormat("ko-KR").format(new Date(report.created_at))}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${report.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-[#edf8f3] text-[#287556]"}`}>{report.status === "pending" ? "검토 중" : "처리 완료"}</span></div>)}</div></section> : null}</section>;
}


function categoryLabel(category: string) {
  return ({ fake_profile: "사칭·허위 프로필", harassment: "괴롭힘·불쾌한 언행", money_request: "금전 요구", no_show: "약속 불이행", married: "기혼 의심", other: "기타" } as Record<string,string>)[category] || "신고";
}
