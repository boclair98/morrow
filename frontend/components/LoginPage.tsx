"use client";

import {
  ArrowLeft,
  Check,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { SocialLoginOptions } from "@/components/SocialLoginOptions";

const trustPoints = [
  "비밀번호를 MORROW에 저장하지 않아요",
  "연락처는 상대에게 공개되지 않아요",
  "매치된 두 사람만 대화할 수 있어요",
];

export function LoginPage() {
  return (
    <main className="morrow-login min-h-screen w-full overflow-x-hidden bg-[#f6f6f4] pb-20 text-[#111]">
      <header className="border-b border-[#e7e7e4] bg-white">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-bold text-[#555] transition hover:text-black"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">홈으로</span>
          </Link>
          <Link
            href="/"
            className="text-[22px] font-black tracking-[-0.055em]"
            aria-label="MORROW 홈"
          >
            MORROW
          </Link>
          <span className="w-4 sm:w-[58px]" aria-hidden="true" />
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-64px)] w-full min-w-0 max-w-[1180px] lg:grid-cols-[1fr_480px] lg:items-stretch">
        <section className="relative flex min-h-[210px] flex-col justify-end overflow-hidden p-6 text-white sm:min-h-[320px] sm:p-8 lg:min-h-0 lg:justify-between lg:p-12">
          <Image
            src="/images/dating-hero.webp"
            alt="카페 거리에서 편안하게 대화하며 걷는 두 성인의 데이트 분위기"
            fill
            priority
            sizes="(max-width: 1023px) 100vw, 60vw"
            className="object-cover object-[62%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#21191b]/90 via-[#21191b]/35 to-transparent lg:bg-gradient-to-r lg:from-[#21191b]/90 lg:via-[#21191b]/45 lg:to-transparent" />
          <div className="relative">
            <p className="flex items-center gap-2 text-xs font-extrabold tracking-[0.12em] text-[#ff8ba1]">
              <Sparkles className="size-4" />
              REAL CONNECTION
            </p>
            <h1 className="mt-4 max-w-[520px] text-[30px] font-extrabold leading-[1.12] tracking-[-0.05em] sm:text-[38px] lg:mt-7 lg:text-[52px]">
              오늘의 대화가
              <br />
              내일의 약속이 되도록.
            </h1>
            <p className="mt-3 hidden max-w-[450px] text-base font-medium leading-8 text-white/70 sm:block lg:mt-6">
              실제 회원이 직접 등록한 프로필만 사용하고, 서로 관심을 보낸
              두 사람만 안전하게 대화를 시작합니다.
            </p>
          </div>

          <div className="relative hidden gap-3 border-t border-white/20 pt-7 lg:grid">
            {trustPoints.map((point) => (
              <p key={point} className="flex items-center gap-3 text-sm font-semibold text-white/75">
                <span className="grid size-6 place-items-center rounded-full bg-white/10 text-[#ff8ba1]">
                  <Check className="size-3.5" />
                </span>
                {point}
              </p>
            ))}
          </div>
        </section>

        <section className="flex min-w-0 items-start justify-center px-4 py-8 sm:px-8 sm:py-12 lg:items-center lg:bg-white lg:px-12">
          <div className="w-full min-w-0 max-w-[390px] rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-[0_18px_60px_rgba(17,17,17,0.06)] sm:p-8 lg:border-0 lg:p-0 lg:shadow-none">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#fff0f3] px-3 py-1.5 text-[11px] font-extrabold text-[#dc3458]">
              <ShieldCheck className="size-3.5" />
              안전한 소셜 로그인
            </div>
            <h1 className="mt-5 text-[30px] font-extrabold leading-tight tracking-[-0.04em] sm:text-[34px]">
              로그인하고
              <br />
              인연을 만나보세요
            </h1>
            <p className="mt-3 text-sm font-medium leading-6 text-[#6f6f6f]">
              별도 비밀번호 없이 사용 중인 계정으로 바로 시작할 수 있어요.
            </p>

            <SocialLoginOptions />

            <div className="mt-6 rounded-xl bg-[#f7f7f5] p-4">
              <p className="flex items-center gap-2 text-xs font-extrabold text-[#333]">
                <LockKeyhole className="size-3.5" />
                로그인 후 진행되는 단계
              </p>
              <p className="mt-2 text-[11px] font-medium leading-5 text-[#777]">
                기본 정보 → 취향·가능 시간 → 사진 등록(선택) → 안전 약속 순서로
                진행돼요. 등록 전에는 다른 회원에게 노출되지 않습니다.
              </p>
            </div>

            <p className="mt-5 text-center text-[11px] font-medium leading-5 text-[#8a8a8a]">
              계속하면 MORROW의{" "}
              <a href="/terms" className="font-bold text-[#555] underline underline-offset-2">
                이용약관
              </a>
              과{" "}
              <a href="/privacy" className="font-bold text-[#555] underline underline-offset-2">
                개인정보 처리방침
              </a>
              에 동의하게 됩니다.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
