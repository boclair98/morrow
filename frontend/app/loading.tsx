export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fffaf8] px-5 text-[#24191d]">
      <div className="text-center" role="status" aria-live="polite">
        <p className="text-xs font-black tracking-[0.16em] text-[#ea365d]">MORROW</p>
        <p className="mt-3 text-sm font-bold text-[#786970]">서비스를 준비하고 있어요…</p>
      </div>
    </main>
  );
}
