"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("MORROW application error", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#fffaf8] px-5 py-12 text-[#24191d]">
      <section className="w-full max-w-md rounded-3xl border border-[#f0dfe3] bg-white p-7 text-center shadow-[0_20px_60px_rgba(80,32,45,.08)]">
        <p className="text-xs font-black tracking-[0.16em] text-[#ea365d]">MORROW</p>
        <h1 className="mt-3 text-2xl font-black tracking-[-0.04em]">잠깐 문제가 생겼어요</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[#786970]">
          입력 중인 내용은 유지하지 못할 수 있어요. 다시 시도하면 대부분 바로 해결됩니다.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 h-12 w-full rounded-xl bg-[#ea365d] text-sm font-black text-white transition hover:bg-[#d92d53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea365d] focus-visible:ring-offset-2"
        >
          다시 시도
        </button>
      </section>
    </main>
  );
}
