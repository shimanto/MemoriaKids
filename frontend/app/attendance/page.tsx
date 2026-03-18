"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LogIn,
  LogOut,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

type AttendanceStatus = "present" | "absent" | "not_yet";

interface Child {
  id: string;
  name: string;
  class: string;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
}

const initialChildren: Child[] = [
  { id: "1", name: "田中 はるき", class: "ひまわり組", status: "present", checkInTime: "08:15" },
  { id: "2", name: "佐藤 ゆい", class: "さくら組", status: "present", checkInTime: "08:30" },
  { id: "3", name: "鈴木 そうた", class: "ひまわり組", status: "present", checkInTime: "08:05" },
  { id: "4", name: "高橋 めい", class: "たんぽぽ組", status: "absent" },
  { id: "5", name: "渡辺 ゆうと", class: "さくら組", status: "not_yet" },
  { id: "6", name: "伊藤 りこ", class: "ひまわり組", status: "present", checkInTime: "08:45" },
  { id: "7", name: "山本 こはる", class: "たんぽぽ組", status: "not_yet" },
  { id: "8", name: "中村 れん", class: "さくら組", status: "present", checkInTime: "08:20" },
  { id: "9", name: "小林 あおい", class: "ひまわり組", status: "absent" },
  { id: "10", name: "加藤 ひなた", class: "たんぽぽ組", status: "present", checkInTime: "09:00" },
];

const statusLabel: Record<AttendanceStatus, { text: string; color: string }> = {
  present: { text: "登園済み", color: "text-green-600 bg-green-50" },
  absent: { text: "欠席", color: "text-red-600 bg-red-50" },
  not_yet: { text: "未登園", color: "text-gray-500 bg-gray-100" },
};

export default function AttendancePage() {
  const [children, setChildren] = useState<Child[]>(initialChildren);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("all");

  const classes = ["all", "ひまわり組", "さくら組", "たんぽぽ組"];

  const filtered = children.filter((c) => {
    const matchSearch = c.name.includes(search);
    const matchClass = filterClass === "all" || c.class === filterClass;
    return matchSearch && matchClass;
  });

  const presentCount = children.filter((c) => c.status === "present").length;
  const absentCount = children.filter((c) => c.status === "absent").length;
  const notYetCount = children.filter((c) => c.status === "not_yet").length;

  function handleCheckIn(id: string) {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setChildren((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: "present" as const, checkInTime: time } : c
      )
    );
  }

  function handleCheckOut(id: string) {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setChildren((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, checkOutTime: time } : c
      )
    );
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
                <p className="text-xl font-bold">{presentCount}名</p>
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
              <Clock className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">未登園</p>
                <p className="text-xl font-bold">{notYetCount}名</p>
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
            <div className="flex gap-1">
              {classes.map((cls) => (
                <button
                  key={cls}
                  onClick={() => setFilterClass(cls)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    filterClass === cls
                      ? "bg-primary-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cls === "all" ? "全クラス" : cls}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Children list */}
        <Card>
          <CardHeader>
            <CardTitle>園児一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 font-medium">園児名</th>
                    <th className="pb-3 font-medium">クラス</th>
                    <th className="pb-3 font-medium">ステータス</th>
                    <th className="pb-3 font-medium">登園時間</th>
                    <th className="pb-3 font-medium">降園時間</th>
                    <th className="pb-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((child) => (
                    <tr key={child.id} className="hover:bg-gray-50">
                      <td className="py-3 font-medium text-gray-900">
                        {child.name}
                      </td>
                      <td className="py-3 text-gray-600">{child.class}</td>
                      <td className="py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusLabel[child.status].color}`}
                        >
                          {statusLabel[child.status].text}
                        </span>
                      </td>
                      <td className="py-3 text-gray-600">
                        {child.checkInTime ?? "—"}
                      </td>
                      <td className="py-3 text-gray-600">
                        {child.checkOutTime ?? "—"}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {child.status === "not_yet" && (
                            <Button
                              size="sm"
                              onClick={() => handleCheckIn(child.id)}
                            >
                              <LogIn className="h-3.5 w-3.5" />
                              登園
                            </Button>
                          )}
                          {child.status === "present" && !child.checkOutTime && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCheckOut(child.id)}
                            >
                              <LogOut className="h-3.5 w-3.5" />
                              降園
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
