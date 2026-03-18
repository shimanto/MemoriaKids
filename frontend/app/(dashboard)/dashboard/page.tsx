"use client";

import { useEffect } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  ClipboardCheck,
  BookOpen,
  TrendingUp,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { useDashboardStats } from "@/lib/hooks";
import { useAuthStore } from "@/lib/auth";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { attendance, contactBook, isLoading } = useDashboardStats();

  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const dayStr = days[today.getDay()];

  const attendanceRecords = attendance.data?.data ?? [];
  const contactEntries = contactBook.data?.data ?? [];

  const checkedInCount = attendanceRecords.filter(
    (r) => r.status === "checked_in"
  ).length;
  const totalChildren = attendanceRecords.length;
  const contactCount = contactEntries.length;

  const stats = [
    {
      label: "本日の在園児",
      value: String(checkedInCount),
      sub: `/ ${totalChildren}名`,
      icon: Users,
      color: "text-nursery-green",
      bg: "bg-green-50",
    },
    {
      label: "出欠登録済み",
      value: String(totalChildren),
      sub: "名",
      icon: ClipboardCheck,
      color: "text-nursery-blue",
      bg: "bg-blue-50",
    },
    {
      label: "連絡帳",
      value: String(contactCount),
      sub: "件",
      icon: BookOpen,
      color: "text-nursery-purple",
      bg: "bg-purple-50",
    },
    {
      label: "今月の身体測定",
      value: "—",
      sub: "",
      icon: TrendingUp,
      color: "text-nursery-pink",
      bg: "bg-pink-50",
    },
  ];

  const recentContacts = contactEntries.slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Date and greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
          <p className="text-sm text-gray-500 mt-1">
            {dateStr}（{dayStr}） — おはようございます
            {user?.name ? `、${user.name}` : ""}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-gray-500">読み込み中...</span>
          </div>
        ) : (
          <>
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
                  {recentContacts.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">
                      本日の連絡帳はまだありません
                    </p>
                  ) : (
                    <div className="flex flex-col divide-y">
                      {recentContacts.map((entry) => (
                        <div
                          key={entry.id}
                          className="py-3 first:pt-0 last:pb-0"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-gray-900">
                                {entry.childName}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400">
                              {entry.authorName}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-1">
                            {entry.activities ?? entry.notes ?? "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Today's attendance overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-nursery-blue" />
                    本日の出欠状況
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {attendanceRecords.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">
                      出欠記録はまだありません
                    </p>
                  ) : (
                    <div className="flex flex-col divide-y">
                      {attendanceRecords.slice(0, 8).map((record) => (
                        <div
                          key={record.id}
                          className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                        >
                          <span className="text-sm font-medium text-gray-900">
                            {record.childName}
                          </span>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              record.status === "checked_in"
                                ? "bg-green-50 text-green-600"
                                : record.status === "checked_out"
                                  ? "bg-blue-50 text-blue-600"
                                  : "bg-red-50 text-red-600"
                            }`}
                          >
                            {record.status === "checked_in"
                              ? "登園済み"
                              : record.status === "checked_out"
                                ? "降園済み"
                                : "欠席"}
                          </span>
                        </div>
                      ))}
                      {attendanceRecords.length > 8 && (
                        <p className="pt-2 text-center text-xs text-gray-400">
                          他{attendanceRecords.length - 8}名
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
