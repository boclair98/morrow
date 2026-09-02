"use client";

import {
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Compass,
  Heart,
  Home,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";

import { SignInLink } from "@/components/SignIn";
import { useMe } from "@/lib/identity";

const MorrowDashboard = dynamic(
  () =>
    import("@/components/MorrowDashboard").then(
      (module) => module.MorrowDashboard,
    ),
  { loading: () => <DashboardLoading /> },
);

const loginHref = "/login?return_to=%2F";

function DashboardLoading() {
  return (
    <main
      className="grid min-h-screen place-items-center bg-[#fff8fa] px-5 text-[#171014]"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-sm rounded-[24px] border border-[#f0e4e8] bg-white p-6 shadow-[0_18px_60px_rgba(82,28,49,0.08)]">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-[14px] bg-[#ff416c] text-sm font-black text-white">
            M
          </span>
          <div>
            <p className="font-extrabold">MORROW를 여는 중</p>
            <p className="mt-0.5 text-xs font-medium text-[#8f7f85]">
              내 취향과 매치를 준비하고 있어요.
            </p>
          </div>
        </div>
        <div className="mt-6 space-y-2.5" aria-hidden="true">
          <span className="block h-3 w-3/4 animate-pulse rounded-full bg-[#f5e9ed]" />
          <span className="block h-3 w-full animate-pulse rounded-full bg-[#f5e9ed]" />
          <span className="block h-3 w-2/3 animate-pulse rounded-full bg-[#f5e9ed]" />
        </div>
      </div>
    </main>
  );
}

const navigation = ["추천", "데이트 취향", "이번 주", "3분 Sync", "안전"];

const quickDiscovery = [
  { icon: Clock3, label: "시간 먼저", color: "bg-[#fff0f4] text-[#f03768]" },
  { icon: CalendarDays, label: "이번 주", color: "bg-[#f1edff] text-[#7655e9]" },
  { icon: MapPin, label: "동네 매칭", color: "bg-[#eaf8ff] text-[#3185bd]" },
  { icon: Sparkles, label: "취향 발견", color: "bg-[#fff5dd] text-[#d38a16]" },
  { icon: MessageCircle, label: "첫 대화", color: "bg-[#eafaf3] text-[#26966c]" },
  { icon: BadgeCheck, label: "사진 인증", color: "bg-[#fff0ec] text-[#dc664b]" },
];

const datePicks = [
  {
    image: "/images/date-cafe.webp",
    badge: "가볍게 시작",
    title: "대화가 길어지는 카페",
    body: "부담 없는 한 잔부터",
    position: "object-center",
  },
  {
    image: "/images/date-gallery.webp",
    badge: "취향 공유",
    title: "같이 보고 싶은 전시",
    body: "할 말이 자연스럽게 생기는 날",
    position: "object-center",
  },
  {
    image: "/images/dating-hero.webp",
    badge: "천천히 가까이",
    title: "햇살 좋은 동네 산책",
    body: "걷다 보면 편해지는 사이",
    position: "object-[62%_center]",
  },
  {
    image: "/images/morrow-campaign-v2.jpg",
    badge: "이번 주 가능",
    title: "시간이 맞는 첫 만남",
    body: "미루지 않고 약속까지",
    position: "object-[67%_center]",
  },
];

const coreFeatures = [
  {
    icon: Clock3,
    label: "TIME FIRST",
    title: "시간이 맞는 사람부터",
    body: "이번 주 실제로 만날 수 있는 시간을 회원이 직접 선택해요.",
  },
  {
    icon: Sparkles,
    label: "TASTE MATCH",
    title: "조건보다 취향을 선명하게",
    body: "좋아하는 공간과 대화 방식으로 공통점을 발견해요.",
  },
  {
    icon: ShieldCheck,
    label: "SAFE DATE",
    title: "연락처 없이 약속까지",
    body: "앱 안에서 대화하고 공개 장소를 함께 정할 수 있어요.",
  },
];

const syncSteps = [
  "두 사람이 같은 질문을 확인해요",
  "상대 답을 보기 전 각자 답해요",
  "동시에 열고 자연스럽게 대화해요",
];

export function SaiApp() {
  const me = useMe();

  if (me) return <MorrowDashboard me={me} />;

  return (
    <main className="min-h-screen overflow-x-hidden bg-white pb-[76px] text-[#171014] md:pb-0">
      <div className="bg-[#ff5c77] px-4 py-2 text-center text-[11px] font-bold text-white sm:text-xs">
        만 20세 이상 · 실제 회원 데이터는 로그인 후에만 보여요
      </div>

      <header className="sticky top-0 z-40 border-b border-[#f0e7ea] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[58px] max-w-[1180px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <a
            href="#top"
            className="shrink-0 text-[21px] font-black tracking-[-0.065em]"
            aria-label="MORROW 홈"
          >
            MORROW
          </a>

          <a
            href="#picks"
            className="mx-auto hidden h-10 max-w-[420px] flex-1 items-center gap-2 rounded-full bg-[#f6f3f4] px-4 text-sm font-medium text-[#92858a] sm:flex"
          >
            <Search className="size-4" />
            어떤 데이트를 좋아하세요?
          </a>

          <a
            href="#picks"
            className="ml-auto grid size-10 place-items-center rounded-full text-[#33282c] transition hover:bg-[#f8f3f5] sm:ml-0"
            aria-label="데이트 취향 찾기"
          >
            <Search className="size-5" />
          </a>
          <SignInLink size="sm" />
        </div>

        <nav
          aria-label="서비스 카테고리"
          className="mx-auto flex h-11 max-w-[1180px] items-center gap-7 overflow-x-auto px-4 text-sm font-semibold [scrollbar-width:none] sm:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden"
        >
          {navigation.map((item, index) => (
            <a
              key={item}
              href={
                index === 0
                  ? "#top"
                  : index === 1
                    ? "#picks"
                    : index === 4
                      ? "#safety"
                      : "#features"
              }
              className={`relative flex h-full shrink-0 items-center ${
                index === 0
                  ? "font-black text-[#f03768] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#f03768]"
                  : "text-[#655a5e] hover:text-[#f03768]"
              }`}
            >
              {item}
            </a>
          ))}
        </nav>
      </header>

      <section id="top" className="mx-auto max-w-[1180px] px-3 pt-3 sm:px-6 sm:pt-6 lg:px-8">
        <div className="relative min-h-[440px] overflow-hidden rounded-[22px] bg-[#fff1f4] sm:min-h-[480px] lg:min-h-[520px] lg:rounded-[30px]">
          <Image
            src="/images/morrow-campaign-v2.jpg"
            alt="밝은 거리에서 첫 데이트를 시작하는 두 성인의 캠페인 장면"
            fill
            priority
            sizes="(max-width: 1180px) 100vw, 1120px"
            className="object-cover object-[64%_center] sm:object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#fff6f7] via-[#fff6f7]/90 to-[#fff6f7]/5 sm:via-[#fff6f7]/72" />

          <div className="relative z-10 flex min-h-[440px] max-w-[255px] flex-col justify-center px-6 py-10 sm:min-h-[480px] sm:max-w-[500px] sm:px-10 lg:min-h-[520px] lg:px-14">
            <p className="flex items-center gap-1.5 text-[11px] font-black tracking-[0.12em] text-[#ed3261] sm:text-xs">
              <Heart className="size-3.5 fill-current" /> MORROW PICK
            </p>
            <h1 className="mt-4 text-[35px] font-black leading-[1.08] tracking-[-0.06em] sm:text-[52px] lg:text-[60px]">
              취향을 고르듯,
              <br />
              내 인연을 발견해요.
            </h1>
            <p className="mt-4 text-[13px] font-semibold leading-6 text-[#745e66] sm:max-w-[420px] sm:text-[16px] sm:leading-7">
              사진만 넘기지 말고, 시간과 취향이 맞는 사람을 만나보세요.
            </p>
            <div className="mt-6 w-[190px] sm:w-auto">
              <SignInLink size="lg" />
            </div>
            <div className="mt-5 hidden flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-[#79666d] sm:flex">
              <span className="flex items-center gap-1"><Check className="size-3.5 text-[#ed3261]" />무료 시작</span>
              <span className="flex items-center gap-1"><Check className="size-3.5 text-[#ed3261]" />시간 우선 추천</span>
              <span className="flex items-center gap-1"><Check className="size-3.5 text-[#ed3261]" />연락처 비공개</span>
            </div>
          </div>

          <div className="absolute bottom-4 right-4 rounded-full bg-black/75 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur-md sm:bottom-6 sm:right-6">
            서비스 연출 이미지 · 실제 회원 아님
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black text-[#f03768]">QUICK DISCOVERY</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.04em] sm:text-2xl">오늘 뭐 하고 싶어요?</h2>
          </div>
          <a href="#picks" className="flex items-center text-xs font-bold text-[#85777c] sm:text-sm">
            전체 보기 <ChevronRight className="size-4" />
          </a>
        </div>

        <div className="mt-5 grid grid-flow-col auto-cols-[74px] gap-3 overflow-x-auto pb-1 [scrollbar-width:none] sm:grid-cols-6 sm:auto-cols-auto sm:gap-4 sm:overflow-visible [&::-webkit-scrollbar]:hidden">
          {quickDiscovery.map(({ icon: Icon, label, color }) => (
            <a key={label} href={loginHref} className="group text-center">
              <span className={`mx-auto grid size-[62px] place-items-center rounded-[20px] transition group-hover:-translate-y-1 ${color}`}>
                <Icon className="size-6" strokeWidth={2.2} />
              </span>
              <span className="mt-2 block text-[11px] font-bold text-[#4d4246] sm:text-xs">{label}</span>
            </a>
          ))}
        </div>
      </section>

      <div className="border-y border-[#f1eaec] bg-[#fff9fb]">
        <div className="mx-auto flex max-w-[1180px] items-center justify-center gap-5 overflow-x-auto px-4 py-3 text-[11px] font-bold text-[#716368] [scrollbar-width:none] sm:gap-10 sm:text-xs [&::-webkit-scrollbar]:hidden">
          <span className="flex shrink-0 items-center gap-1.5"><BadgeCheck className="size-4 text-[#ed3261]" /> 사진 등록 회원</span>
          <span className="flex shrink-0 items-center gap-1.5"><Clock3 className="size-4 text-[#ed3261]" /> 가능한 시간 직접 선택</span>
          <span className="flex shrink-0 items-center gap-1.5"><ShieldCheck className="size-4 text-[#ed3261]" /> 앱 안에서 안전하게</span>
        </div>
      </div>

      <section id="picks" className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black tracking-[0.08em] text-[#f03768]">MORROW DATE PICK</p>
            <h2 className="mt-1 text-[26px] font-black tracking-[-0.05em] sm:text-[34px]">끌리는 데이트부터 골라보세요</h2>
            <p className="mt-2 text-sm font-medium text-[#89797f]">선택한 취향은 실제 회원 추천에 활용돼요.</p>
          </div>
          <a href={loginHref} className="hidden items-center text-sm font-bold sm:flex">
            내 취향 시작하기 <ChevronRight className="size-4" />
          </a>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">
          {datePicks.map((pick) => (
            <a key={pick.title} href={loginHref} className="group min-w-0">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[18px] bg-[#f3edef] sm:rounded-[22px]">
                <Image
                  src={pick.image}
                  alt={`${pick.title} 분위기를 표현한 서비스 이미지`}
                  fill
                  sizes="(max-width: 639px) 46vw, (max-width: 1023px) 24vw, 260px"
                  className={`object-cover transition duration-500 group-hover:scale-[1.035] ${pick.position}`}
                />
                <span className="absolute left-2.5 top-2.5 rounded-full bg-[#ff416c] px-2.5 py-1 text-[10px] font-black text-white shadow-sm sm:left-3 sm:top-3 sm:text-[11px]">{pick.badge}</span>
                <span className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-white/90 text-[#33282c] shadow-sm backdrop-blur-sm sm:right-3 sm:top-3">
                  <Heart className="size-4" />
                </span>
              </div>
              <p className="mt-3 text-[11px] font-black text-[#f03768]">취향 매칭</p>
              <h3 className="mt-1 truncate text-[15px] font-black tracking-[-0.025em] sm:text-lg">{pick.title}</h3>
              <p className="mt-1 truncate text-xs font-medium text-[#8a7b80] sm:text-sm">{pick.body}</p>
            </a>
          ))}
        </div>

        <p className="mt-6 text-[11px] font-medium leading-5 text-[#a29599]">
          위 사진은 데이트 분위기를 표현한 서비스 이미지입니다. 실제 회원 프로필은 가입 후 실데이터로만 제공됩니다.
        </p>
      </section>

      <section id="features" className="bg-[#faf7f8]">
        <div className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="text-center">
            <p className="text-[11px] font-black tracking-[0.1em] text-[#f03768]">WHY MORROW</p>
            <h2 className="mt-2 text-[28px] font-black tracking-[-0.05em] sm:text-[38px]">구경에서 끝나지 않는 소개팅</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-6 text-[#85777c] sm:text-base">
              발견하고, 대화하고, 실제 약속을 잡는 순간까지 하나로 연결했어요.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:mt-10 sm:gap-5 md:grid-cols-3">
            {coreFeatures.map(({ icon: Icon, label, title, body }) => (
              <article key={label} className="rounded-[22px] border border-[#eee4e7] bg-white p-6 sm:p-8">
                <span className="grid size-11 place-items-center rounded-[15px] bg-[#fff0f4] text-[#ed3261]">
                  <Icon className="size-5" />
                </span>
                <p className="mt-7 text-[10px] font-black tracking-[0.1em] text-[#ed3261]">{label}</p>
                <h3 className="mt-2 text-xl font-black tracking-[-0.035em]">{title}</h3>
                <p className="mt-3 text-sm font-medium leading-6 text-[#817278]">{body}</p>
              </article>
            ))}
          </div>

          <div className="mt-5 grid overflow-hidden rounded-[24px] bg-[#171014] text-white lg:grid-cols-[0.9fr_1.1fr]">
            <div className="p-7 sm:p-10 lg:p-12">
              <p className="flex items-center gap-2 text-xs font-black tracking-[0.1em] text-[#ff7593]">
                <Zap className="size-4 fill-current" /> 3 MINUTE SYNC
              </p>
              <h2 className="mt-4 text-[30px] font-black leading-[1.15] tracking-[-0.05em] sm:text-[40px]">
                첫 인사 고민을
                <br />
                3분으로 줄였어요.
              </h2>
              <p className="mt-4 max-w-md text-sm font-medium leading-6 text-white/65 sm:text-base">
                복붙 인사 대신 같은 질문에 답하고, 서로의 답을 동시에 확인해요.
              </p>
              <div className="mt-7 max-w-[210px]">
                <SignInLink size="lg" />
              </div>
            </div>
            <div className="grid divide-y divide-white/10 bg-[#241a1e]">
              {syncSteps.map((step, index) => (
                <div key={step} className="grid grid-cols-[34px_1fr] items-center gap-3 p-6 sm:px-9 sm:py-7">
                  <span className="text-sm font-black text-[#ff7593]">0{index + 1}</span>
                  <p className="font-bold tracking-[-0.015em]">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="safety" className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-6 rounded-[24px] bg-[#fff0f4] p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:p-12">
          <div>
            <p className="flex items-center gap-2 text-xs font-black text-[#ed3261]"><ShieldCheck className="size-4" /> SAFETY FIRST</p>
            <h2 className="mt-3 text-[27px] font-black tracking-[-0.045em] sm:text-[36px]">설레기 전에, 먼저 안전하게.</h2>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[#79666d] sm:text-base">
              연락처를 바로 공개하지 않고 앱 안에서 대화해요. 차단과 신고, 공개 장소 약속 제안도 바로 사용할 수 있어요.
            </p>
          </div>
          <div className="w-full lg:w-[220px]">
            <SignInLink size="lg" />
          </div>
        </div>
      </section>

      <footer className="border-t border-[#eee7e9] bg-[#faf8f9]">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-9 text-xs text-[#85777c] sm:px-6 lg:px-8">
          <p className="text-lg font-black tracking-[-0.05em] text-[#171014]">MORROW</p>
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            <a href="#features" className="hover:text-black">서비스 소개</a>
            <a href="#safety" className="hover:text-black">안전 가이드</a>
            <a href="/terms" className="hover:text-black">이용약관</a>
            <a href="/privacy" className="hover:text-black">개인정보 처리방침</a>
            <a href="/community-guidelines" className="hover:text-black">커뮤니티 가이드</a>
            <a href="/account-deletion" className="hover:text-black">계정 삭제</a>
          </div>
          <p>© 2026 MORROW · 실제 회원 데이터는 로그인 후에만 제공됩니다.</p>
        </div>
      </footer>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 grid h-[68px] grid-cols-5 border-t border-[#eee7e9] bg-white px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="모바일 하단 메뉴"
      >
        <MobileNavItem href="#top" icon={Home} label="홈" active />
        <MobileNavItem href="#picks" icon={Compass} label="취향" />
        <MobileNavItem href="#features" icon={Sparkles} label="매칭" />
        <MobileNavItem href="#safety" icon={ShieldCheck} label="안전" />
        <MobileNavItem href={loginHref} icon={UserRound} label="로그인" />
      </nav>
    </main>
  );
}

function MobileNavItem({
  href,
  icon: Icon,
  label,
  active = false,
}: {
  href: string;
  icon: typeof Home;
  label: string;
  active?: boolean;
}) {
  return (
    <a
      href={href}
      className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-bold ${
        active ? "text-[#f03768]" : "text-[#81757a]"
      }`}
    >
      <Icon className="size-[19px]" strokeWidth={active ? 2.5 : 2} />
      <span>{label}</span>
    </a>
  );
}
