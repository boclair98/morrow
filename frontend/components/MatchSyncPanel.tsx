"use client";

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import {
  answerMatchSync,
  fetchMatchSync,
  MatchSyncRevealedRound,
  MatchSyncSession,
  startMatchSync,
} from "@/lib/api";

type MatchSyncPanelProps = {
  matchId: string;
  partnerName: string;
  refreshKey: number;
  onOpenPlans: () => void;
};

function SyncRoundCard({ round }: { round: MatchSyncRevealedRound }) {
  return (
    <article className="rounded-2xl border border-[#e8e0e2] bg-white p-4 shadow-[0_8px_30px_rgba(40,20,26,.04)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff385c]">
          ROUND {round.round + 1}
        </p>
        <CheckCircle2 className="size-4 text-[#34a36f]" />
      </div>
      <p className="mt-2 text-sm font-black leading-6 text-[#262124]">
        {round.prompt}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {round.answers.map((answer) => (
          <div
            key={`${round.round}-${answer.mine ? "mine" : "partner"}`}
            className={`rounded-xl px-3 py-3 text-sm font-semibold leading-6 ${answer.mine ? "bg-[#fff0f3] text-[#7f3247]" : "bg-[#f4f4f4] text-[#3f3b3e]"}`}
          >
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.12em] opacity-60">
              {answer.mine ? "나" : "상대"}
            </p>
            {answer.answer}
          </div>
        ))}
      </div>
    </article>
  );
}

function LoadingSync() {
  return (
    <div className="space-y-4 p-5" aria-busy="true" aria-label="Sync 불러오는 중">
      <div className="h-28 animate-pulse rounded-2xl bg-[#ece8e9]" />
      <div className="h-40 animate-pulse rounded-2xl bg-[#ece8e9]" />
    </div>
  );
}

export function MatchSyncPanel({
  matchId,
  partnerName,
  refreshKey,
  onOpenPlans,
}: MatchSyncPanelProps) {
  const [session, setSession] = useState<MatchSyncSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const result = await fetchMatchSync(matchId);
      if (version !== requestVersion.current) return;
      setSession(result.session);
      setError(null);
    } catch (cause) {
      if (version !== requestVersion.current) return;
      setError(cause instanceof Error ? cause.message : "Sync를 불러오지 못했어요");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh, refreshKey]);

  async function begin() {
    if (saving) return;
    requestVersion.current += 1;
    setSaving(true);
    setError(null);
    try {
      const result = await startMatchSync(matchId);
      setSession(result.session);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sync를 시작하지 못했어요");
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session || !session.can_answer || !answer.trim() || saving) return;
    requestVersion.current += 1;
    setSaving(true);
    setError(null);
    try {
      const result = await answerMatchSync(
        matchId,
        session.current_round,
        answer.trim(),
      );
      setSession(result.session);
      setAnswer("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "답변을 보내지 못했어요");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSync />;

  return (
    <div className="flex-1 overflow-y-auto bg-[#fbf9fa] p-4 sm:p-5">
      <div className="mx-auto max-w-xl space-y-4">
        {error ? (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold leading-5 text-red-700"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void refresh()}
              className="shrink-0 rounded-lg p-1 text-red-700 hover:bg-red-100"
              aria-label="Sync 다시 불러오기"
            >
              <RefreshCw className="size-4" />
            </button>
          </div>
        ) : null}

        {!session ? (
          <section className="overflow-hidden rounded-2xl border border-[#eadfe2] bg-white shadow-[0_16px_50px_rgba(54,27,36,.08)]">
            <div className="relative overflow-hidden bg-[#1c1518] px-5 py-7 text-white sm:px-7">
              <div className="absolute -right-12 -top-16 size-44 rounded-full bg-[#ff385c]/25 blur-2xl" />
              <div className="relative">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-[#ffb8c5]">
                  <Sparkles className="size-3" /> MORROW SYNC
                </span>
                <h2 className="mt-4 text-[26px] font-black leading-tight tracking-[-0.04em] sm:text-[30px]">
                  첫 문장 대신,
                  <br />
                  같은 질문에 답해보세요.
                </h2>
                <p className="mt-3 max-w-sm text-sm font-medium leading-6 text-white/65">
                  {partnerName}님과 같은 질문에 답하고, 둘 다 제출한 순간에만
                  답변이 공개돼요.
                </p>
              </div>
            </div>
            <div className="p-5 sm:p-7">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-[#fff5f6] px-3 py-3">
                  <LockKeyhole className="size-4 text-[#ff385c]" />
                  <p className="mt-2 text-xs font-black">동시 공개</p>
                  <p className="mt-1 text-[11px] font-medium leading-4 text-[#777]">
                    답변은 혼자 볼 수 없어요
                  </p>
                </div>
                <div className="rounded-xl bg-[#f5f4ff] px-3 py-3">
                  <Clock3 className="size-4 text-[#6f5dc4]" />
                  <p className="mt-2 text-xs font-black">3라운드</p>
                  <p className="mt-1 text-[11px] font-medium leading-4 text-[#777]">
                    3분이면 충분해요
                  </p>
                </div>
                <div className="rounded-xl bg-[#f2faf6] px-3 py-3">
                  <CheckCircle2 className="size-4 text-[#2f9a6c]" />
                  <p className="mt-2 text-xs font-black">연락처 불필요</p>
                  <p className="mt-1 text-[11px] font-medium leading-4 text-[#777]">
                    MORROW 안에서 안전하게
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void begin()}
                disabled={saving}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ff385c] text-sm font-black text-white transition hover:bg-[#e93254] disabled:cursor-wait disabled:opacity-60"
              >
                {saving ? "Sync 준비 중…" : "3분 Sync 시작하기"}
                {!saving ? <ArrowRight className="size-4" /> : null}
              </button>
              <p className="mt-3 text-center text-[11px] font-medium text-[#999]">
                부담되면 언제든 채팅으로 돌아갈 수 있어요.
              </p>
            </div>
          </section>
        ) : (
          <>
            {session.status === "active" ? (
              <section className="rounded-2xl border border-[#eadfe2] bg-white p-5 shadow-[0_12px_36px_rgba(54,27,36,.06)] sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff385c]">
                      MORROW SYNC
                    </p>
                    <h2 className="mt-1 text-xl font-black tracking-[-0.03em]">
                      {session.current_round + 1}라운드
                      <span className="font-medium text-[#aaa]">
                        {" "}/ {session.total_rounds}
                      </span>
                    </h2>
                  </div>
                  <span className="rounded-full bg-[#f5f1f2] px-2.5 py-1 text-[10px] font-black text-[#777]">
                    {session.current_round_answers === 1
                      ? "한 명 답변 완료"
                      : "서로의 속도로"}
                  </span>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#f0edef]">
                  <div
                    className="h-full rounded-full bg-[#ff385c] transition-all duration-500"
                    style={{
                      width: `${Math.min(100, ((session.current_round + (session.current_round_answers ? 0.5 : 0)) / session.total_rounds) * 100)}%`,
                    }}
                  />
                </div>
                <div className="mt-6 rounded-2xl bg-[#fff7f8] p-4 sm:p-5">
                  <p className="text-[10px] font-black tracking-[0.08em] text-[#d45d73]">
                    QUESTION {session.current_round + 1}
                  </p>
                  <p className="mt-2 text-lg font-black leading-7 tracking-[-0.025em] text-[#31272b]">
                    {session.prompts[session.current_round]?.text}
                  </p>
                  {session.can_answer ? (
                    <form onSubmit={submit} className="mt-4">
                      <label htmlFor="sync-answer" className="sr-only">
                        Sync 답변
                      </label>
                      <textarea
                        id="sync-answer"
                        value={answer}
                        onChange={(event) => setAnswer(event.target.value)}
                        maxLength={180}
                        rows={3}
                        placeholder="정답은 없어요. 지금 떠오르는 대로 적어보세요."
                        className="w-full resize-none rounded-xl border border-[#ecd9dd] bg-white px-3.5 py-3 text-sm font-medium leading-6 outline-none transition placeholder:text-[#b7aaae] focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/15"
                      />
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-[10px] font-medium text-[#9b8e93]">
                          {answer.length}/180
                        </span>
                        <button
                          type="submit"
                          disabled={!answer.trim() || saving}
                          className="flex h-10 items-center gap-1.5 rounded-lg bg-[#1c1518] px-4 text-xs font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          {saving ? "보내는 중…" : "답변 보내기"}
                          {!saving ? <Send className="size-3.5" /> : null}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#ecd9dd] bg-white px-3.5 py-3 text-xs font-bold leading-5 text-[#765d64]">
                      <LockKeyhole className="mt-0.5 size-4 shrink-0 text-[#ff385c]" />
                      <span>
                        {session.waiting_for_partner
                          ? `${partnerName}님이 답하면 두 답변이 함께 공개돼요.`
                          : `${partnerName}님이 먼저 답했어요. 이제 내 답변을 보내보세요.`}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <section className="overflow-hidden rounded-2xl border border-[#dceee4] bg-white shadow-[0_12px_36px_rgba(33,100,66,.07)]">
                <div className="bg-[#edf9f2] px-5 py-6 sm:px-7">
                  <div className="flex items-center gap-2 text-[#25865a]">
                    <CheckCircle2 className="size-5" />
                    <p className="text-xs font-black tracking-[0.08em]">
                      SYNC COMPLETE
                    </p>
                  </div>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#20372a]">
                    이제 대화가 조금
                    <br />
                    쉬워졌을 거예요.
                  </h2>
                  <p className="mt-2 text-sm font-medium text-[#5c7565]">
                    서로의 답변을 바탕으로 작은 다음 장면을 골라보세요.
                  </p>
                </div>
                <div className="p-5 sm:p-7">
                  {session.summary ? (
                    <div className="space-y-3">
                      {session.summary.common_interests.length ? (
                        <div>
                          <p className="text-[10px] font-black tracking-[0.12em] text-[#999]">
                            COMMON INTERESTS
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {session.summary.common_interests.map((interest) => (
                              <span
                                key={interest}
                                className="rounded-full bg-[#fff0f3] px-2.5 py-1 text-xs font-black text-[#c83e5b]"
                              >
                                #{interest}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {session.summary.common_times.length ? (
                        <div>
                          <p className="text-[10px] font-black tracking-[0.12em] text-[#999]">
                            GOOD TIME
                          </p>
                          <p className="mt-1 text-sm font-bold text-[#383236]">
                            {session.summary.common_times.join(" · ")}
                          </p>
                        </div>
                      ) : null}
                      <div className="rounded-xl bg-[#f8f7f7] px-3.5 py-3.5">
                        <p className="text-[10px] font-black tracking-[0.12em] text-[#999]">
                          FIRST DATE SPARK
                        </p>
                        <p className="mt-1.5 text-sm font-black leading-6 text-[#383236]">
                          {session.summary.first_date_idea}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={onOpenPlans}
                    className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1c1518] text-sm font-black text-white transition hover:bg-black"
                  >
                    <CalendarDays className="size-4" />
                    약속으로 이어가기
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </section>
            )}

            {session.revealed_rounds.length ? (
              <section>
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-xs font-black text-[#6f6569]">함께 공개된 답변</p>
                  <span className="text-[10px] font-bold text-[#aaa]">
                    {session.revealed_rounds.length}/{session.total_rounds}
                  </span>
                </div>
                <div className="space-y-3">
                  {session.revealed_rounds.map((round) => (
                    <SyncRoundCard key={round.round} round={round} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
