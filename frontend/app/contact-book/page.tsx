"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Send,
  Thermometer,
  Utensils,
  Moon,
  Smile,
  ChevronRight,
  Loader2,
  Plus,
} from "lucide-react";
import {
  useContactBook,
  useCreateContactBookEntry,
  type ContactBookEntry,
} from "@/lib/hooks";
import { useAuthStore } from "@/lib/auth";

const moodLabels: Record<string, string> = {
  happy: "元気",
  neutral: "ふつう",
  sad: "元気なし",
  tired: "疲れ気味",
  excited: "はりきり",
};

const mealLabels: Record<string, string> = {
  all: "完食",
  most: "ほぼ完食",
  some: "少し残した",
  none: "食べなかった",
};

export default function ContactBookPage() {
  const [selectedEntry, setSelectedEntry] = useState<ContactBookEntry | null>(null);
  const [replyText, setReplyText] = useState("");
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, isLoading, error } = useContactBook({ date: dateFilter });
  const createEntry = useCreateContactBookEntry();

  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  const entries = data?.data ?? [];
  const unrepliedCount = entries.filter((e) => !e.notes).length;

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const dayStr = days[today.getDay()];

  function handleReply() {
    if (!selectedEntry || !replyText.trim()) return;
    createEntry.mutate(
      {
        childId: selectedEntry.childId,
        date: dateFilter,
        notes: replyText,
      },
      {
        onSuccess: () => {
          setReplyText("");
        },
      }
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">連絡帳</h1>
            <p className="text-sm text-gray-500 mt-1">
              {dateStr}（{dayStr}）の連絡帳
            </p>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {entries.length > 0 && (
                <>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-primary-500" />
                    {entries.length}件
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-gray-500">読み込み中...</span>
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            データの取得に失敗しました。再度お試しください。
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Entry list */}
            <div className="lg:col-span-2 flex flex-col gap-3">
              {entries.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <BookOpen className="h-10 w-10 text-gray-300" />
                    <p className="mt-3 text-sm text-gray-400">
                      この日の連絡帳はまだありません
                    </p>
                  </CardContent>
                </Card>
              ) : (
                entries.map((entry) => (
                  <Card
                    key={entry.id}
                    className={`cursor-pointer transition-shadow hover:shadow-md ${
                      selectedEntry?.id === entry.id
                        ? "ring-2 ring-primary-500"
                        : ""
                    }`}
                    onClick={() => {
                      setSelectedEntry(entry);
                      setReplyText("");
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {entry.childName}
                          </span>
                          {entry.mood && (
                            <span className="text-xs text-gray-400">
                              {moodLabels[entry.mood] ?? entry.mood}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ChevronRight className="h-4 w-4 text-gray-300" />
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {entry.activities ?? entry.notes ?? "記載なし"}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {entry.authorName}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Detail view */}
            <div className="lg:col-span-3">
              {selectedEntry ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-nursery-purple" />
                      {selectedEntry.childName}の連絡帳
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {selectedEntry.mood && (
                        <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
                          <Smile className="h-4 w-4 text-nursery-green" />
                          <div>
                            <p className="text-xs text-gray-500">機嫌</p>
                            <p className="text-sm font-medium">
                              {moodLabels[selectedEntry.mood] ?? selectedEntry.mood}
                            </p>
                          </div>
                        </div>
                      )}
                      {selectedEntry.meals && (
                        <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
                          <Utensils className="h-4 w-4 text-nursery-yellow" />
                          <div>
                            <p className="text-xs text-gray-500">食事</p>
                            <p className="text-sm font-medium">
                              {selectedEntry.meals.lunch
                                ? `昼食: ${mealLabels[selectedEntry.meals.lunch] ?? selectedEntry.meals.lunch}`
                                : "記録なし"}
                            </p>
                          </div>
                        </div>
                      )}
                      {selectedEntry.nap && (
                        <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
                          <Moon className="h-4 w-4 text-nursery-blue" />
                          <div>
                            <p className="text-xs text-gray-500">お昼寝</p>
                            <p className="text-sm font-medium">
                              {selectedEntry.nap.startTime && selectedEntry.nap.endTime
                                ? `${selectedEntry.nap.startTime}〜${selectedEntry.nap.endTime}`
                                : selectedEntry.nap.quality
                                  ? `質: ${selectedEntry.nap.quality}`
                                  : "記録なし"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Activities */}
                    {selectedEntry.activities && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">
                          活動内容
                        </p>
                        <div className="rounded-lg bg-blue-50 p-4 text-sm text-gray-700">
                          {selectedEntry.activities}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {selectedEntry.notes && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">
                          メモ・連絡事項
                        </p>
                        <div className="rounded-lg bg-green-50 p-4 text-sm text-gray-700">
                          {selectedEntry.notes}
                        </div>
                      </div>
                    )}

                    {/* Reply form */}
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        返信・追記
                      </p>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="園での様子を保護者にお伝えしましょう..."
                        rows={4}
                        className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      />
                      <div className="flex justify-end mt-3">
                        <Button
                          onClick={handleReply}
                          disabled={!replyText.trim() || createEntry.isPending}
                        >
                          {createEntry.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          返信する
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex h-64 items-center justify-center">
                    <div className="text-center">
                      <BookOpen className="mx-auto h-10 w-10 text-gray-300" />
                      <p className="mt-3 text-sm text-gray-400">
                        左のリストから連絡帳を選択してください
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
