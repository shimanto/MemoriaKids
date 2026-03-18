"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TrendingUp,
  Ruler,
  Weight,
  Calendar,
  Plus,
  ChevronDown,
} from "lucide-react";

interface GrowthRecord {
  date: string;
  height: number;
  weight: number;
}

interface ChildGrowth {
  id: string;
  name: string;
  class: string;
  birthDate: string;
  records: GrowthRecord[];
}

const childrenGrowth: ChildGrowth[] = [
  {
    id: "1",
    name: "田中 はるき",
    class: "ひまわり組",
    birthDate: "2022-04-15",
    records: [
      { date: "2025-04", height: 95.2, weight: 14.1 },
      { date: "2025-07", height: 97.5, weight: 14.6 },
      { date: "2025-10", height: 99.8, weight: 15.0 },
      { date: "2026-01", height: 101.3, weight: 15.4 },
    ],
  },
  {
    id: "2",
    name: "佐藤 ゆい",
    class: "さくら組",
    birthDate: "2022-08-20",
    records: [
      { date: "2025-04", height: 92.0, weight: 13.0 },
      { date: "2025-07", height: 94.1, weight: 13.3 },
      { date: "2025-10", height: 96.0, weight: 13.8 },
      { date: "2026-01", height: 97.8, weight: 14.2 },
    ],
  },
  {
    id: "3",
    name: "鈴木 そうた",
    class: "ひまわり組",
    birthDate: "2022-01-10",
    records: [
      { date: "2025-04", height: 98.5, weight: 15.5 },
      { date: "2025-07", height: 100.8, weight: 16.0 },
      { date: "2025-10", height: 103.0, weight: 16.5 },
      { date: "2026-01", height: 104.6, weight: 17.0 },
    ],
  },
];

export default function GrowthPage() {
  const [selectedChild, setSelectedChild] = useState<ChildGrowth>(
    childrenGrowth[0]
  );
  const [showForm, setShowForm] = useState(false);

  const latest = selectedChild.records[selectedChild.records.length - 1];
  const previous =
    selectedChild.records.length > 1
      ? selectedChild.records[selectedChild.records.length - 2]
      : null;

  const heightDiff = previous ? (latest.height - previous.height).toFixed(1) : null;
  const weightDiff = previous ? (latest.weight - previous.weight).toFixed(1) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">成長記録</h1>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" />
            計測記録を追加
          </Button>
        </div>

        {/* Child selector */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {childrenGrowth.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setSelectedChild(child)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    selectedChild.id === child.id
                      ? "bg-primary-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {child.name}
                  <span className="ml-1 text-xs opacity-70">{child.class}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Add form */}
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">新しい計測記録</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  id="measure-date"
                  label="計測日"
                  type="date"
                  defaultValue="2026-03-18"
                />
                <Input
                  id="height"
                  label="身長 (cm)"
                  type="number"
                  step="0.1"
                  placeholder="例: 102.5"
                />
                <Input
                  id="weight"
                  label="体重 (kg)"
                  type="number"
                  step="0.1"
                  placeholder="例: 15.8"
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  キャンセル
                </Button>
                <Button onClick={() => setShowForm(false)}>保存する</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Latest stats */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="rounded-xl bg-blue-50 p-2.5">
                    <Ruler className="h-5 w-5 text-nursery-blue" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">最新の身長</p>
                    <p className="text-2xl font-bold">{latest.height} cm</p>
                  </div>
                </div>
                {heightDiff && (
                  <p className="text-xs text-green-600">
                    前回比 +{heightDiff} cm
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="rounded-xl bg-pink-50 p-2.5">
                    <Weight className="h-5 w-5 text-nursery-pink" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">最新の体重</p>
                    <p className="text-2xl font-bold">{latest.weight} kg</p>
                  </div>
                </div>
                {weightDiff && (
                  <p className="text-xs text-green-600">
                    前回比 +{weightDiff} kg
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-purple-50 p-2.5">
                    <Calendar className="h-5 w-5 text-nursery-purple" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">生年月日</p>
                    <p className="text-sm font-medium">
                      {selectedChild.birthDate}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Growth chart placeholder + history */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-nursery-blue" />
                  成長推移グラフ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-56 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
                  <div className="text-center">
                    <TrendingUp className="mx-auto h-10 w-10 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-400">
                      身長・体重の推移グラフ
                    </p>
                    <p className="text-xs text-gray-300 mt-1">
                      recharts等のライブラリ導入後に表示
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>計測履歴</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">計測日</th>
                      <th className="pb-3 font-medium">身長</th>
                      <th className="pb-3 font-medium">体重</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[...selectedChild.records].reverse().map((record) => (
                      <tr key={record.date}>
                        <td className="py-3 text-gray-900">{record.date}</td>
                        <td className="py-3 text-gray-600">
                          {record.height} cm
                        </td>
                        <td className="py-3 text-gray-600">
                          {record.weight} kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
