"use client";

import { useState, useEffect } from "react";
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
  Loader2,
} from "lucide-react";
import { useGrowthRecords, useAddGrowthRecord } from "@/lib/hooks";
import { useAuthStore } from "@/lib/auth";

export default function GrowthPage() {
  const [selectedChildId, setSelectedChildId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formHeight, setFormHeight] = useState("");
  const [formWeight, setFormWeight] = useState("");

  const { data, isLoading, error } = useGrowthRecords(selectedChildId);
  const addRecord = useAddGrowthRecord();

  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  const records = data?.data ?? [];
  const child = data?.child;

  const latest = records.length > 0 ? records[0] : null;
  const previous = records.length > 1 ? records[1] : null;

  const heightDiff =
    latest?.heightCm && previous?.heightCm
      ? (latest.heightCm - previous.heightCm).toFixed(1)
      : null;
  const weightDiff =
    latest?.weightKg && previous?.weightKg
      ? (latest.weightKg - previous.weightKg).toFixed(1)
      : null;

  function handleSave() {
    if (!selectedChildId) return;
    const body: {
      childId: string;
      date: string;
      heightCm?: number;
      weightKg?: number;
    } = {
      childId: selectedChildId,
      date: formDate,
    };
    if (formHeight) body.heightCm = parseFloat(formHeight);
    if (formWeight) body.weightKg = parseFloat(formWeight);

    addRecord.mutate(body, {
      onSuccess: () => {
        setShowForm(false);
        setFormHeight("");
        setFormWeight("");
      },
    });
  }

  // If no child is selected yet, show a prompt
  if (!selectedChildId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">成長記録</h1>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-500 mb-4">
                園児IDを入力して成長記録を表示します
              </p>
              <div className="flex gap-3 max-w-md">
                <input
                  type="text"
                  placeholder="園児ID（UUID）を入力..."
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSelectedChildId(e.currentTarget.value);
                    }
                  }}
                />
                <Button
                  onClick={(e) => {
                    const input = (e.currentTarget as HTMLElement)
                      .previousElementSibling as HTMLInputElement;
                    if (input?.value) setSelectedChildId(input.value);
                  }}
                >
                  表示
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">成長記録</h1>
            {child && (
              <p className="text-sm text-gray-500 mt-1">{child.name}</p>
            )}
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" />
            計測記録を追加
          </Button>
        </div>

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
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
                <Input
                  id="height"
                  label="身長 (cm)"
                  type="number"
                  step="0.1"
                  placeholder="例: 102.5"
                  value={formHeight}
                  onChange={(e) => setFormHeight(e.target.value)}
                />
                <Input
                  id="weight"
                  label="体重 (kg)"
                  type="number"
                  step="0.1"
                  placeholder="例: 15.8"
                  value={formWeight}
                  onChange={(e) => setFormWeight(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  キャンセル
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={addRecord.isPending || (!formHeight && !formWeight)}
                >
                  {addRecord.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  保存する
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-gray-500">読み込み中...</span>
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 mb-6">
            データの取得に失敗しました。園児IDを確認してください。
            <Button
              variant="outline"
              size="sm"
              className="ml-3"
              onClick={() => setSelectedChildId("")}
            >
              戻る
            </Button>
          </div>
        ) : (
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
                      <p className="text-2xl font-bold">
                        {latest?.heightCm ?? "—"} cm
                      </p>
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
                      <p className="text-2xl font-bold">
                        {latest?.weightKg ?? "—"} kg
                      </p>
                    </div>
                  </div>
                  {weightDiff && (
                    <p className="text-xs text-green-600">
                      前回比 +{weightDiff} kg
                    </p>
                  )}
                </CardContent>
              </Card>
              {child && (
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-purple-50 p-2.5">
                        <Calendar className="h-5 w-5 text-nursery-purple" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">生年月日</p>
                        <p className="text-sm font-medium">
                          {child.dateOfBirth}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
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
                  {records.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">
                      計測記録がありません
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="pb-3 font-medium">計測日</th>
                          <th className="pb-3 font-medium">身長</th>
                          <th className="pb-3 font-medium">体重</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {records.map((record) => (
                          <tr key={record.id}>
                            <td className="py-3 text-gray-900">
                              {record.date}
                            </td>
                            <td className="py-3 text-gray-600">
                              {record.heightCm ? `${record.heightCm} cm` : "—"}
                            </td>
                            <td className="py-3 text-gray-600">
                              {record.weightKg ? `${record.weightKg} kg` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
