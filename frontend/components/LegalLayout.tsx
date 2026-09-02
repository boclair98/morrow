import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";


export function LegalLayout({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: ReactNode }) {
  return <main className="min-h-screen bg-[#f6f6f4] px-4 py-6 text-[#111] sm:py-10"><article className="mx-auto max-w-3xl rounded-xl border border-[#e2e2e2] bg-white p-6 sm:p-10"><Link href="/" className="inline-flex items-center gap-1 text-sm font-black"><ArrowLeft className="size-4" />MORROW로 돌아가기</Link><div className="mt-10 border-b-2 border-black pb-6"><p className="flex items-center gap-2 text-xs font-black text-[#ff385c]"><ShieldCheck className="size-4" />{eyebrow}</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-4xl">{title}</h1><p className="mt-3 text-xs font-bold text-[#888]">시행일·최종 업데이트 {updated}</p></div><div className="legal-copy py-7">{children}</div><footer className="border-t border-[#e5e5e5] pt-6 text-xs font-medium leading-5 text-[#777]">MORROW 운영팀 · 서비스 내 안전센터를 통해 문의 및 권리 행사를 접수할 수 있습니다.</footer></article></main>;
}
