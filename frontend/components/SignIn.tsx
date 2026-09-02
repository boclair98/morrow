"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { signOut } from "@/lib/api";
import { cn } from "@/lib/utils";

export function SignInLink({
  returnTo = "/",
  size = "default",
}: {
  returnTo?: string;
  size?: "sm" | "default" | "lg";
}) {
  const href = `/login?return_to=${encodeURIComponent(returnTo)}`;

  return (
    <a
      href={href}
      className={cn(
        buttonVariants({ size }),
        size === "lg"
          ? "h-12 w-full rounded-md bg-[#111111] px-6 text-sm font-extrabold text-white shadow-none hover:bg-[#ff385c] lg:w-auto"
          : "h-10 rounded-md bg-[#111111] px-4 text-xs font-bold text-white shadow-none hover:bg-[#ff385c]",
      )}
    >
      {size === "sm" ? "로그인" : "무료로 시작하기"}
    </a>
  );
}

export function SignOutLink({ returnTo = "/" }: { returnTo?: string }) {
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
      window.location.assign(returnTo);
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={busy}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      <LogOut className="size-3.5" />
      {busy ? "로그아웃 중" : "로그아웃"}
    </button>
  );
}
