"use client";

import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  ClipboardCheck,
  BookOpen,
  TrendingUp,
  AlertCircle,
  Clock,
} from "lucide-react";

const stats = [
  {
    label: "本日の在園児",
    value: "42",
    sub: "/ 50名",
    icon: Users,
    color: "text-nursery-green",
    bg: "bg-green-50",
  },
  {
    label: "出欠登録済み",
    value: "38",
    sub: "名完了",
    icon: ClipboardCheck,
    color: "text-nursery-blue",
    bg: "bg-blue-50",
  },
  {
    label: "未読の連絡帳",
    value: "5",
    sub: "件",
    icon: BookOpen,
    color: "text-nursery-purple",
    bg: "bg-purple-50",
  },
  {
    label: "今月の身体測定",
    value: "12",
    sub: "名未実施",
    icon: TrendingUp,
    color: "text-nursery-pink",
    bg: "bg-pink-50",
  },
];

const recentContacts = [
  {
    child: "田中 はるき",
    class: "ひまわり組",
    parent: "田中 美咲",
    message: "昨夜少し咳が出ていました。日中の様子を教えてください。",
    time: "8:15",
    unread: true,
  },
  {
    child: "佐藤 ゆい",
    class: "さくら組",
    parent: "佐藤 健太",
    message: "土曜日のお迎えは祖母が行きます。よろしくお願いします。",
    time: "7:50",
    unread: true,
  },
  {
    child: "鈴木 そうた",
    class: "ひまわり組",
    parent: "鈴木 あかり",
    message:
      "お弁当日のお知らせありがとうございました。準備します！",
    time: "昨日",
    unread: false,
  },
];

const alerts = [
  { text: "鈴木 りこちゃんが37.5℃の発熱です", level: "warning" as const },
  { text: "14:00〜 避難訓練の予定があります", level: "info" as const },
];

export default function DashboardPage() {
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const dayStr = days[today.getDay()];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Date and greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
          <p className="text-sm text-gray-500 mt-1">
            {dateStr}（{dayStr}） — おはようございます、山田先生
          </p>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="mb-6 flex flex-col gap-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${
                  alert.level === "warning"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-blue-50 text-blue-800"
                }`}
              >
                {alert.level === "warning" ? (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 shrink-0" />
                )}
                {alert.text}
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`rounded-xl ${stat.bg} p-3`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stat.value}
                    <span className="text-sm font-normal text-gray-400 ml-0.5">
                      {stat.sub}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent contacts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-nursery-purple" />
                最近の連絡帳
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col divide-y">
                {recentContacts.map((contact, i) => (
                  <div key={i} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900">
                          {contact.child}
                        </span>
                        <span className="text-xs text-gray-400">
                          {contact.class}
                        </span>
                        {contact.unread && (
                          <span className="h-2 w-2 rounded-full bg-primary-500" />
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {contact.time}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-1">
                      {contact.parent}: {contact.message}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Growth chart placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-nursery-pink" />
                成長チャート
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
                <div className="text-center">
                  <TrendingUp className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-400">
                    園児の身長・体重推移グラフ
                  </p>
                  <p className="text-xs text-gray-300 mt-1">
                    データ連携後に表示されます
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
