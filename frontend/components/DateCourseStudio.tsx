'use client';

import { useMemo, useState } from "react";
import { ArrowRight, Clock3, Sparkles, WalletCards } from "lucide-react";

export type DateCourseSuggestion = {
  id: string;
  title: string;
  tagline: string;
  stops: string[];
  duration: string;
  budget: string;
  note: string;
};

type DateCourseStudioProps = {
  area: string;
  partnerName: string;
  commonInterests: string[];
  onPick: (suggestion: DateCourseSuggestion) => void;
};

function includesAny(values: string[], keywords: string[]) {
  return keywords.some((keyword) => values.some((value) => value.includes(keyword)));
}

function buildSuggestions(
  area: string,
  partnerName: string,
  commonInterests: string[],
): DateCourseSuggestion[] {
  const interests = commonInterests.length ? commonInterests : ["카페", "산책"];
  const culture = includesAny(interests, ["전시", "영화", "독서", "음악"]);
  const food = includesAny(interests, ["맛집", "요리", "카페"]);
  const active = includesAny(interests, ["산책", "러닝", "운동", "여행"]);

  return [
    {
      id: "culture",
      title: culture ? `${area} 전시 보고 카페에서 이야기하기` : `${area} 카페에서 취향 알아가기`,
      tagline: culture ? "공통 취향을 천천히 발견하는 코스" : "부담 없이 대화를 시작하는 코스",
      stops: culture ? ["작은 전시·서점", "조용한 카페", "동네 산책"] : ["분위기 좋은 카페", "서점 또는 소품숍", "동네 산책"],
      duration: "약 2시간",
      budget: "1인 1–3만원",
      note: `${partnerName}님과 ${interests.slice(0, 2).join("·")} 이야기를 나눌 수 있는 코스로 골라봤어요. 첫 만남은 사람이 많은 장소에서 천천히 시작해요.`,
    },
    {
      id: "food",
      title: food ? `${area} 맛집 한 곳과 디저트 산책` : `${area} 가벼운 식사와 야경 산책`,
      tagline: "식사를 핑계로 자연스럽게 가까워지는 코스",
      stops: food ? ["대화하기 좋은 식당", "디저트 카페", "10분 산책"] : ["예약 가능한 식당", "카페 또는 아이스크림", "사람 많은 길 산책"],
      duration: "약 2시간 30분",
      budget: "1인 2–4만원",
      note: `서로 좋아하는 ${interests.slice(0, 2).join("·")}를 주제로 대화해보세요. 메뉴는 만남 전에 함께 정하면 더 편해요.`,
    },
    {
      id: "active",
      title: active ? `${area} 가볍게 걷고 쉬어가는 데이트` : `${area} 동네 산책 후 카페 데이트`,
      tagline: "어색함을 줄이고 리듬을 맞추는 코스",
      stops: active ? ["공원 또는 산책로", "가벼운 체험", "카페에서 마무리"] : ["사람 많은 산책로", "사진 한 장", "카페에서 마무리"],
      duration: "약 2시간",
      budget: "1인 1–2만원",
      note: `대화가 끊겨도 자연스럽게 넘어갈 수 있도록 걷는 시간을 섞었어요. ${partnerName}님과 속도를 맞춰가며 진행해보세요.`,
    },
  ];
}

export function DateCourseStudio({
  area,
  partnerName,
  commonInterests,
  onPick,
}: DateCourseStudioProps) {
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(
    () => buildSuggestions(area, partnerName, commonInterests),
    [area, commonInterests, partnerName],
  );

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-[#eadff0] bg-[#fcf9ff]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eee6ff] text-[#7957b8]">
            <Sparkles className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-black tracking-[.08em] text-[#7957b8]">MORROW AI 코스 · 공통 취향 베타</span>
            <span className="mt-1 block truncate text-sm font-black text-[#40364d]">두 사람에게 어울리는 첫 만남 코스를 골라보세요</span>
            <span className="mt-1 block text-[11px] font-semibold text-[#887c91]">외부 AI API 없이 공통 취향·지역을 조합해 추천해요.</span>
          </span>
        </span>
        <ArrowRight className={`size-4 shrink-0 text-[#8a72ae] transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open ? (
        <div className="grid gap-2 border-t border-[#eadff0] p-3 sm:grid-cols-3">
          {suggestions.map((suggestion) => (
            <button
              type="button"
              key={suggestion.id}
              onClick={() => {
                onPick(suggestion);
                setOpen(false);
              }}
              className="rounded-xl border border-[#eee6f3] bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-[#ccb8e7]"
            >
              <span className="block text-sm font-black leading-5 text-[#42364d]">{suggestion.title}</span>
              <span className="mt-1 block text-[11px] font-semibold leading-4 text-[#887c91]">{suggestion.tagline}</span>
              <span className="mt-3 flex items-center gap-2 text-[10px] font-black text-[#6f6375]">
                <Clock3 className="size-3" /> {suggestion.duration}
                <WalletCards className="ml-1 size-3" /> {suggestion.budget}
              </span>
              <span className="mt-3 block text-[11px] font-bold leading-4 text-[#786c80]">{suggestion.stops.join(" → ")}</span>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-black text-[#7957b8]">이 코스로 채우기 <ArrowRight className="size-3" /></span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
