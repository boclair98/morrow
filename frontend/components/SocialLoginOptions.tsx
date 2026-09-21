"use client";

import Script from "next/script";
import { ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchAuthProviders,
  startSocialLogin,
  type AuthConfiguration,
  type AuthProvider,
} from "@/lib/api";

type TurnstileApi = {
  render: (
    target: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      language?: string;
      theme: "light";
      appearance: "always";
      size: "flexible";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
      "error-callback": (errorCode?: string) => boolean;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// This is public bootstrap data, not an OAuth secret. It lets the login UI and
// Turnstile render on the first paint instead of blocking on an API pod that
// may be waking from scale-to-zero. The server response refreshes it in the
// background and remains the authority for whether a login can actually start.
const bootstrapConfig: AuthConfiguration = {
  native: null,
  turnstile_required: true,
  turnstile_site_key: "0x4AAAAAAEZAIL-BxPmnHCt2",
  kakao_map_js_key: null,
  providers: [
    { id: "kakao", label: "카카오", configured: true, status: "active" },
    { id: "naver", label: "네이버", configured: true, status: "active" },
    { id: "google", label: "Google", configured: true, status: "active" },
  ],
};

const authErrorMessages: Record<string, string> = {
  cancelled: "로그인이 취소됐어요.",
  expired: "로그인 시간이 만료됐어요. 다시 시도해주세요.",
  account_conflict: "같은 이메일의 기존 계정이 있어요. 기존 로그인 방법을 이용해주세요.",
  configuration: "로그인 설정을 확인하고 있어요. 잠시 후 다시 시도해주세요.",
  provider: "로그인 제공사와 연결하지 못했어요. 잠시 후 다시 시도해주세요.",
};

export function SocialLoginOptions() {
  const [config, setConfig] = useState<AuthConfiguration>(bootstrapConfig);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<AuthProvider["id"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [turnstileState, setTurnstileState] = useState<"loading" | "ready" | "error" | "disabled">(
    bootstrapConfig.turnstile_required ? "loading" : "disabled",
  );
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);
  const [turnstileScriptAttempt, setTurnstileScriptAttempt] = useState(0);
  const widgetHost = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const code = new URLSearchParams(window.location.search).get("auth_error");
      if (!code) return;
      setError(
        (current) => current ?? (authErrorMessages[code] ?? "로그인을 완료하지 못했어요."),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    fetchAuthProviders()
      .then((nextConfig) => {
        if (active) setConfig(nextConfig);
      })
      // Bootstrap data keeps the controls usable while the backend wakes. A
      // failed refresh is handled authoritatively by the login-start endpoint.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const renderTurnstile = useCallback(() => {
    if (
      !config?.turnstile_required ||
      !config.turnstile_site_key ||
      !window.turnstile ||
      !turnstileLoaded ||
      !widgetHost.current ||
      widgetId.current
    ) {
      if (!config?.turnstile_required) setTurnstileState("disabled");
      return;
    }
    setTurnstileState("loading");
    if (!widgetHost.current || widgetId.current || !window.turnstile) return;
    widgetId.current = window.turnstile.render(widgetHost.current, {
      sitekey: config.turnstile_site_key,
      action: "social_login",
      language: "ko",
      theme: "light",
      appearance: "always",
      size: "flexible",
      callback: (nextToken) => {
        setToken(nextToken);
        setTurnstileState("ready");
        setError(null);
      },
      "expired-callback": () => {
        setToken("");
        setTurnstileState("loading");
        setError("보안 확인이 만료됐어요. 다시 확인해주세요.");
      },
      "timeout-callback": () => {
        setToken("");
        setTurnstileState("error");
        setError("보안 확인 시간이 초과됐어요. 아래에서 다시 시도해주세요.");
      },
      "error-callback": (errorCode) => {
        setToken("");
        setTurnstileState("error");
        setError(
          errorCode
            ? `보안 확인에 실패했어요 (${errorCode}). 다시 시도해주세요.`
            : "보안 확인에 실패했어요. 다시 시도해주세요.",
        );
        return true;
      },
    });
  }, [config, turnstileLoaded]);

  useEffect(() => {
    const renderTimer = window.setTimeout(() => renderTurnstile(), 0);
    return () => {
      window.clearTimeout(renderTimer);
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [renderTurnstile, turnstileLoaded]);

  function retryTurnstile() {
    setError(null);
    setToken("");
    setTurnstileState("loading");
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      return;
    }
    setTurnstileLoaded(false);
    setTurnstileScriptAttempt((attempt) => attempt + 1);
  }

  async function start(provider: AuthProvider) {
    if (!provider.configured || busy) return;
    if (config?.turnstile_required && (turnstileState !== "ready" || !token)) {
      setError("보안 확인이 끝난 뒤 로그인 버튼을 눌러주세요.");
      return;
    }
    setBusy(provider.id);
    setError(null);
    try {
      const params = new URLSearchParams(window.location.search);
      const referralCode = params.get("ref");
      const returnTo = params.get("return_to") || "/";
      if (referralCode) {
        try {
          window.localStorage.setItem("morrow_referral_code", referralCode);
        } catch {
          // Referral capture is optional; it must never block social login.
        }
      }
      const result = await startSocialLogin(provider.id, token, returnTo);
      window.location.assign(result.authorization_url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "로그인을 시작하지 못했어요.");
      setBusy(null);
      setToken("");
      if (widgetId.current && window.turnstile) {
        window.turnstile.reset(widgetId.current);
      }
    }
  }

  const providers = config.providers;
  const enabled = providers.filter((provider) => provider.configured);

  return (
    <section id="login" className="mt-5 max-w-[390px] scroll-mt-24" aria-labelledby="social-login-title">
      {config?.turnstile_required ? (
        <Script
          key={`turnstile-${turnstileScriptAttempt}`}
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => setTurnstileLoaded(true)}
          onError={() => {
            setTurnstileState("error");
            setError("보안 확인 스크립트를 불러오지 못했어요. 아래에서 다시 시도해주세요.");
          }}
        />
      ) : null}
      <div className="mb-3 flex items-center gap-3 text-[11px] font-semibold text-[#888]">
        <span className="h-px flex-1 bg-[#ddd]" />
        <span id="social-login-title">무료 소셜 계정으로 시작</span>
        <span className="h-px flex-1 bg-[#ddd]" />
      </div>
      {config?.turnstile_required ? (
        <div className="mb-3 overflow-hidden rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-2">
          <p className="mb-2 text-[10px] font-bold text-[#777]">자동 가입 방지 확인</p>
          <div ref={widgetHost} className="min-h-[65px]" />
          {turnstileState === "loading" ? (
            <p className="mt-1 text-[11px] font-semibold text-[#8b7b81]" aria-live="polite">
              보안 확인을 불러오는 중이에요…
            </p>
          ) : null}
          {turnstileState === "error" ? (
            <button
              type="button"
              onClick={retryTurnstile}
              className="mt-2 h-9 w-full rounded-md border border-[#d8c8cc] bg-white px-3 text-xs font-extrabold text-[#5b454c] transition hover:border-[#ea365d] hover:text-[#ea365d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea365d]"
            >
              보안 확인 다시 시도
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="space-y-2">
        {providers.map((provider) => {
          const active = provider.configured;
          const loading = busy === provider.id;
          const palette =
            provider.id === "kakao"
              ? "border-[#fee500] bg-[#fee500] text-[#191600] hover:bg-[#f7df00]"
              : provider.id === "naver"
                ? "border-[#03c75a] bg-[#03c75a] text-white hover:bg-[#02b853]"
                : "border-[#d8d8d8] bg-white text-[#222] hover:border-[#999]";
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => start(provider)}
              disabled={!active || Boolean(busy) || (config.turnstile_required && turnstileState !== "ready")}
              className={`flex h-12 w-full items-center justify-center gap-3 rounded-lg border text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-45 ${palette}`}
            >
              <span className="grid size-6 place-items-center rounded-full bg-black/10 text-xs font-black">
                {provider.id === "google" ? "G" : provider.id === "naver" ? "N" : "K"}
              </span>
              {loading ? "연결 중..." : `${provider.label}로 계속하기`}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {enabled.length === 0 ? (
        <p className="mt-3 text-xs font-semibold leading-5 text-[#777]">
          로그인 설정을 마무리하고 있어요. 잠시 후 다시 확인해주세요.
        </p>
      ) : null}
      <p className="mt-3 flex items-start gap-2 text-[11px] font-medium leading-5 text-[#777]">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#1a8f5d]" />
        비밀번호는 MORROW가 저장하지 않으며, 로그인 후 약관 동의와 실제 프로필 등록이 진행됩니다.
      </p>
    </section>
  );
}
