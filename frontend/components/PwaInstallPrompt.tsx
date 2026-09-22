"use client";

import { Bell, Download, X } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [notificationVisible, setNotificationVisible] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    const notificationTimer = window.setTimeout(() => {
      if ("Notification" in window && Notification.permission === "default") setNotificationVisible(true);
    }, 0);
    return () => {
      window.clearTimeout(notificationTimer);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setVisible(false);
    setInstallEvent(null);
  }

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationVisible(false);
    if (permission === "granted") window.dispatchEvent(new CustomEvent("morrow:notice", { detail: "새 매치와 메시지 알림을 켰어요" }));
  }

  if (!visible && !notificationVisible) return null;
  return (
    <div className="fixed inset-x-4 bottom-5 z-[80] mx-auto flex max-w-lg flex-col gap-2 sm:right-6 sm:left-auto sm:mx-0">
      {visible ? <div className="flex items-center gap-3 rounded-2xl border border-[#f2d9de] bg-white p-4 shadow-[0_18px_50px_rgba(72,35,46,.18)]"><span className="grid size-10 place-items-center rounded-xl bg-[#fff0f3] text-[#ea365d]"><Download className="size-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-black">MORROW를 홈 화면에 추가할까요?</p><p className="mt-1 text-xs font-medium text-[#88777b]">새로운 연결을 놓치지 않도록 앱처럼 사용할 수 있어요.</p></div><button type="button" onClick={() => void install()} className="rounded-xl bg-[#21191b] px-3 py-2 text-xs font-black text-white">설치</button><button type="button" onClick={() => setVisible(false)} className="grid size-8 place-items-center rounded-full text-[#988a8d]" aria-label="설치 안내 닫기"><X className="size-4" /></button></div> : null}
      {notificationVisible ? <div className="flex items-center gap-3 rounded-2xl border border-[#f2d9de] bg-white p-4 shadow-[0_18px_50px_rgba(72,35,46,.18)]"><span className="grid size-10 place-items-center rounded-xl bg-[#fff0f3] text-[#ea365d]"><Bell className="size-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-black">새 소식 알림을 켤까요?</p><p className="mt-1 text-xs font-medium text-[#88777b]">매치·메시지·약속 변화만 알려드려요.</p></div><button type="button" onClick={() => void enableNotifications()} className="rounded-xl bg-[#ea365d] px-3 py-2 text-xs font-black text-white">알림 켜기</button><button type="button" onClick={() => setNotificationVisible(false)} className="grid size-8 place-items-center rounded-full text-[#988a8d]" aria-label="알림 안내 닫기"><X className="size-4" /></button></div> : null}
    </div>
  );
}
