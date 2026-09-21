import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fffaf8] px-5 py-12 text-[#24191d]">
      <section className="w-full max-w-md rounded-3xl border border-[#f0dfe3] bg-white p-7 text-center shadow-[0_20px_60px_rgba(80,32,45,.08)]">
        <p className="text-xs font-black tracking-[0.16em] text-[#ea365d]">MORROW</p>
        <h1 className="mt-3 text-2xl font-black tracking-[-0.04em]">페이지를 찾을 수 없어요</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[#786970]">
          주소가 바뀌었거나 아직 공개되지 않은 페이지일 수 있어요.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#ea365d] text-sm font-black text-white transition hover:bg-[#d92d53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea365d] focus-visible:ring-offset-2"
        >
          MORROW 홈으로
        </Link>
      </section>
    </main>
  );
}
