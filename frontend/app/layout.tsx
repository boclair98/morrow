import type { ReactNode } from "react";
import type { Metadata } from "next";

import { DevDeployBadge } from "@/components/DevDeployBadge";
import { WarmingBar } from "@/components/WarmingBanner";

import "./globals.css";

const siteUrl = "https://morrow.coders.kr";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "MORROW — 좋아요 말고, 약속이 되는 사람",
  description: "시간과 취향이 맞는 실제 회원을 만나고, 3분 Sync로 첫 대화부터 안전한 약속까지 이어가는 MORROW.",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: siteUrl,
    siteName: "MORROW",
    title: "MORROW — 좋아요 말고, 약속이 되는 사람",
    description: "시간과 취향이 맞는 실제 회원을 만나고, 3분 Sync로 첫 대화부터 안전한 약속까지 이어가는 MORROW.",
    images: [{ url: "/og.png", alt: "MORROW — 좋아요 말고, 약속이 되는 사람" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MORROW — 좋아요 말고, 약속이 되는 사람",
    description: "시간과 취향이 맞는 실제 회원을 만나고, 3분 Sync로 첫 대화부터 안전한 약속까지 이어가는 MORROW.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <WarmingBar />
        <DevDeployBadge />
        {children}
      </body>
    </html>
  );
}
