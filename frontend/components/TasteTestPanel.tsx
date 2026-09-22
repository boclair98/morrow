"use client";

import { Check, ChevronRight, RotateCcw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

const questions = [
  {
    question: "첫 데이트라면 어디가 더 편해요?",
    options: [
      { label: "조용한 카페", value: "calm" },
      { label: "가볍게 산책", value: "active" },
      { label: "전시·공연", value: "culture" },
    ],
  },
  {
    question: "약속을 잡을 때 가장 중요한 건?",
    options: [
      { label: "대화가 잘 통하는지", value: "talk" },
      { label: "시간을 정확히 맞추는지", value: "time" },
      { label: "새로운 경험인지", value: "new" },
    ],
  },
  {
    question: "요즘 나를 가장 잘 설명하는 말은?",
    options: [
      { label: "천천히 알아가요", value: "steady" },
      { label: "이번 주 바로 만나고 싶어요", value: "ready" },
      { label: "취향이 맞는 사람이 좋아요", value: "taste" },
    ],
  },
] as const;

const results: Record<string, { title: string; copy: string }> = {
  calm: { title: "편안한 대화형", copy: "말이 잘 통하고 서로의 속도를 존중하는 인연과 잘 맞아요." },
  active: { title: "가벼운 설렘형", copy: "산책처럼 부담 없이 시작해 자연스럽게 가까워지는 인연이 좋아요." },
  culture: { title: "취향 공유형", copy: "전시·영화처럼 좋아하는 것을 함께 발견하는 만남을 선호해요." },
  talk: { title: "대화 우선형", copy: "첫 메시지부터 진짜 이야기가 이어지는 사람을 만나고 싶어요." },
  time: { title: "약속 신뢰형", copy: "시간을 지키고 배려하는 사람이 가장 큰 호감 포인트예요." },
  new: { title: "새로운 경험형", copy: "같이 해보지 않은 것을 시도할 때 관계가 더 빨리 가까워져요." },
  steady: { title: "천천히 확인형", copy: "작은 대화를 쌓으며 안전하게 알아가는 흐름이 잘 맞아요." },
  ready: { title: "이번 주 만남형", copy: "마음이 맞는다면 미루지 않고 현실적인 약속까지 가고 싶어요." },
  taste: { title: "취향 저격형", copy: "공통 관심사가 많은 사람과 이야기할수록 설렘이 커져요." },
};

export function TasteTestPanel({ onNotice }: { onNotice?: (message: string) => void }) {
  const [answers, setAnswers] = useState<string[]>([]);
  const current = questions[answers.length];
  const result = useMemo(() => answers.length === questions.length ? results[answers[answers.length - 1]] : null, [answers]);

  function choose(value: string) {
    setAnswers((items) => [...items, value]);
    if (answers.length + 1 === questions.length) onNotice?.("취향 테스트 결과를 프로필에 반영해봤어요");
  }

  return (
    <section className="mb-7 overflow-hidden rounded-[26px] border border-[#eadfe9] bg-gradient-to-br from-[#fff8f5] via-white to-[#f6f1ff] p-5 shadow-[0_18px_50px_rgba(86,49,59,.05)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div><p className="flex items-center gap-2 text-[10px] font-black tracking-[.14em] text-[#8557bc]"><Sparkles className="size-3.5" /> MY DATE STYLE</p><h2 className="mt-2 text-xl font-black tracking-[-.03em]">3문장으로 알아보는 나의 만남 취향</h2><p className="mt-1 text-sm font-medium text-[#857477]">결과는 저장하지 않고, 오늘의 추천을 고르는 힌트로만 써요.</p></div>
        {answers.length > 0 ? <button type="button" onClick={() => setAnswers([])} className="grid size-9 place-items-center rounded-full bg-white text-[#8b7d92]" aria-label="테스트 다시하기"><RotateCcw className="size-4" /></button> : null}
      </div>
      {result ? <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#e8dcf3] bg-white/80 p-4"><span className="grid size-10 place-items-center rounded-xl bg-[#f3e9ff] text-[#8557bc]"><Check className="size-5" /></span><div><p className="text-xs font-black text-[#8557bc]">당신의 데이트 스타일</p><p className="mt-1 text-lg font-black">{result.title}</p><p className="mt-1 text-sm font-medium text-[#756b76]">{result.copy}</p></div></div> : current ? <div className="mt-5"><div className="mb-3 flex items-center justify-between text-[11px] font-black text-[#9a899d]"><span>{answers.length + 1} / {questions.length}</span><div className="flex gap-1">{questions.map((item, index) => <span key={item.question} className={`h-1.5 w-10 rounded-full ${index <= answers.length ? "bg-[#8557bc]" : "bg-[#e6dced]"}`} />)}</div></div><p className="text-base font-black">{current.question}</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{current.options.map((option) => <button type="button" key={option.value} onClick={() => choose(option.value)} className="flex min-h-12 items-center justify-between rounded-xl border border-[#e9dfe7] bg-white px-4 text-left text-sm font-bold transition hover:-translate-y-0.5 hover:border-[#8557bc] hover:text-[#8557bc]">{option.label}<ChevronRight className="size-4 text-[#b4a5b9]" /></button>)}</div></div> : null}
    </section>
  );
}
