"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LogIn,
  LogOut,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  useAttendance,
  useCheckIn,
  useCheckOut,
  type AttendanceRecord,
} from "@/lib/hooks";
import { useAuthStore } from "@/lib/auth";

type DisplayStatus = "checked_in" | "checked_out" | "absent" | "not_yet";

const statusLabel: Record<DisplayStatus, { text: string; color: string }> = {
  checked_in: { text: "登園済み", color: "text-green-600 bg-green-50" },
  checked_out: { text: "降園済み", color: "text-blue-600 bg-blue-50" },
  absent: { text: "欠席", color: "text-red-600 bg-red-50" },
  not_yet: { text: "未登園", color: "text-gray-500 bg-gray-100" },
};

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AttendancePage() {
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("all");

  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading, error } = useAttendance({ from: today });
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  const records = data?.data ?? [];

  // Derive unique class names
  const classes = ["all", ...new Set(records.map((r) => r.childName.split(" ")[0] + "組"))];

  const filtered = records.filter((r) => {
    const matchSearch = r.childName.includes(search);
    return matchSearch;
  });

  const checkedInCount = records.filter((r) => r.status === "checked_in").length;
  const checkedOutCount = records.filter((r) => r.status === "checked_out").length;
  const absentCount = records.filter((r) => r.status === "absent").length;

  function handleCheckIn(childId: string) {
    if (!user?.nurseryId) return;
    checkIn.mutate({ childId, nurseryId: user.nurseryId });
  }

  function handleCheckOut(recordId: string) {
    checkOut.mutate({ recordId });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">出欠管理</h1>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-xs text-gray-500">登園済み</p>
                <p className="text-xl font-bold">{checkedInCount}名</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-xs text-gray-500">欠席</p>
                <p className="text-xl font-bold">{absentCount}名</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-gray-500">降園済み</p>
                <p className="text-xl font-bold">{checkedOutCount}名</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="園児名で検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Children list */}
        <Card>
          <CardHeader>
            <CardTitle>出欠一覧</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                <span className="ml-2 text-sm text-gray-500">読み込み中...</span>
              </div>
            ) : error ? (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                データの取得に失敗しました。再度お試しください。
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                出欠記録がありません
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">園児名</th>
                      <th className="pb-3 font-medium">ステータス</th>
                      <th className="pb-3 font-medium">登園時間</th>
                      <th className="pb-3 font-medium">降園時間</th>
                      <th className="pb-3 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((record) => {
                      const displayStatus: DisplayStatus = record.status;
                      return (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="py-3 font-medium text-gray-900">
                            {record.childName}
                          </td>
                          <td className="py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusLabel[displayStatus]?.color ?? "text-gray-500 bg-gray-100"}`}
                            >
                              {statusLabel[displayStatus]?.text ?? record.status}
                            </span>
                          </td>
                          <td className="py-3 text-gray-600">
                            {formatTime(record.checkInTime)}
                          </td>
                          <td className="py-3 text-gray-600">
                            {formatTime(record.checkOutTime)}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex justify-end gap-2">
                              {record.status === "checked_in" &&
                                !record.checkOutTime && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCheckOut(record.id)}
                                    disabled={checkOut.isPending}
                                  >
                                    <LogOut className="h-3.5 w-3.5" />
                                    降園
                                  </Button>
                                )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
