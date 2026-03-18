import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "MemoriaKids — 保育園向け総合プラットフォーム",
  description:
    "出欠管理・連絡帳・成長記録・写真共有をひとつに。保育園の業務をデジタルで支援するMemoriaKids。",
  keywords: ["保育園", "出欠管理", "連絡帳", "成長記録", "写真共有", "ICT"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={notoSansJP.variable}>
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
