import Link from "next/link";
import {
  BookOpen,
  Camera,
  ClipboardCheck,
  TrendingUp,
  Shield,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: ClipboardCheck,
    title: "出欠管理",
    description:
      "QRコードやタッチ操作でかんたん登園・降園打刻。リアルタイムで在園児を把握できます。",
    color: "text-nursery-green",
    bg: "bg-green-50",
  },
  {
    icon: BookOpen,
    title: "デジタル連絡帳",
    description:
      "保護者と保育士の毎日のやりとりをスマホで。写真付きで園での様子を共有できます。",
    color: "text-nursery-blue",
    bg: "bg-blue-50",
  },
  {
    icon: TrendingUp,
    title: "成長記録",
    description:
      "身長・体重の推移をグラフで可視化。発達のマイルストーンも記録・共有できます。",
    color: "text-nursery-purple",
    bg: "bg-purple-50",
  },
  {
    icon: Camera,
    title: "写真共有",
    description:
      "AI顔認識で園児ごとに自動分類。保護者は我が子の写真だけをかんたんに閲覧・購入。",
    color: "text-nursery-pink",
    bg: "bg-pink-50",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-primary-500" />
              <span className="text-xl font-bold text-primary-500">
                MemoriaKids
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                ログイン
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-primary-500 px-5 py-2 text-sm font-medium text-white hover:bg-primary-600 transition-colors"
              >
                無料で始める
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-nursery-yellow/10 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            保育をもっと、
            <br />
            <span className="text-primary-500">あたたかくスマートに。</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600">
            MemoriaKidsは、出欠管理・連絡帳・成長記録・写真共有をひとつにまとめた
            保育園向け総合プラットフォームです。
            保育士の業務負担を軽減し、保護者との絆をより深めます。
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="rounded-full bg-primary-500 px-8 py-3 text-base font-semibold text-white shadow-lg hover:bg-primary-600 transition-colors"
            >
              無料トライアルを始める
            </Link>
            <Link
              href="#features"
              className="rounded-full border border-gray-300 bg-white px-8 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              機能を見る
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              園の運営をまるごとサポート
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              必要な機能がすべて揃った、オールインワンの保育ICTサービス
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div
                  className={`inline-flex rounded-xl ${feature.bg} p-3`}
                >
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="border-t bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Shield className="h-5 w-5" />
            <span className="text-sm font-medium">
              保育園の大切なデータを安全に守ります
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            SSL暗号化通信 ・ データの国内保管 ・ 自動バックアップ ・
            ISMS準拠のセキュリティ体制
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary-500" />
              <span className="font-bold text-primary-500">MemoriaKids</span>
            </div>
            <p className="text-sm text-gray-400">
              &copy; 2026 MemoriaKids. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
