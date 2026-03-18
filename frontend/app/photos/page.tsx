"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Camera,
  Upload,
  Sparkles,
  Image as ImageIcon,
  Filter,
  Download,
  User,
} from "lucide-react";

interface Photo {
  id: string;
  url: string;
  date: string;
  event: string;
  detectedChildren: string[];
  aiProcessed: boolean;
}

const mockPhotos: Photo[] = [
  {
    id: "1",
    url: "",
    date: "2026-03-17",
    event: "園庭遊び",
    detectedChildren: ["田中 はるき", "鈴木 そうた", "伊藤 りこ"],
    aiProcessed: true,
  },
  {
    id: "2",
    url: "",
    date: "2026-03-17",
    event: "園庭遊び",
    detectedChildren: ["佐藤 ゆい", "中村 れん"],
    aiProcessed: true,
  },
  {
    id: "3",
    url: "",
    date: "2026-03-16",
    event: "お絵描き",
    detectedChildren: ["田中 はるき", "佐藤 ゆい", "高橋 めい"],
    aiProcessed: true,
  },
  {
    id: "4",
    url: "",
    date: "2026-03-16",
    event: "お絵描き",
    detectedChildren: ["鈴木 そうた"],
    aiProcessed: true,
  },
  {
    id: "5",
    url: "",
    date: "2026-03-15",
    event: "お誕生日会",
    detectedChildren: [
      "渡辺 ゆうと",
      "加藤 ひなた",
      "田中 はるき",
      "佐藤 ゆい",
    ],
    aiProcessed: true,
  },
  {
    id: "6",
    url: "",
    date: "2026-03-14",
    event: "給食",
    detectedChildren: [],
    aiProcessed: false,
  },
];

const events = ["すべて", "園庭遊び", "お絵描き", "お誕生日会", "給食"];

export default function PhotosPage() {
  const [filterEvent, setFilterEvent] = useState("すべて");
  const [filterChild, setFilterChild] = useState("");

  const filtered = mockPhotos.filter((p) => {
    const matchEvent =
      filterEvent === "すべて" || p.event === filterEvent;
    const matchChild =
      !filterChild || p.detectedChildren.some((c) => c.includes(filterChild));
    return matchEvent && matchChild;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">写真ギャラリー</h1>
            <p className="text-sm text-gray-500 mt-1">
              AI顔認識で園児ごとに自動分類されます
            </p>
          </div>
          <Button>
            <Upload className="h-4 w-4" />
            写真をアップロード
          </Button>
        </div>

        {/* AI badge */}
        <Card className="mb-6 border-purple-100 bg-gradient-to-r from-purple-50 to-pink-50">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-xl bg-white p-2.5 shadow-sm">
              <Sparkles className="h-6 w-6 text-nursery-purple" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                AI顔認識が有効です
              </p>
              <p className="text-sm text-gray-500">
                アップロードされた写真から自動的に園児を検出・分類します。
                保護者は自分のお子さまの写真だけを閲覧できます。
              </p>
            </div>
            <span className="ml-auto hidden sm:inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              稼働中
            </span>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">イベント:</span>
            <div className="flex gap-1">
              {events.map((event) => (
                <button
                  key={event}
                  onClick={() => setFilterEvent(event)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filterEvent === event
                      ? "bg-primary-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {event}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="園児名で絞り込み..."
              value={filterChild}
              onChange={(e) => setFilterChild(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Photo grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((photo) => (
            <Card key={photo.id} className="overflow-hidden group">
              {/* Placeholder image area */}
              <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <div className="text-center">
                  <ImageIcon className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="text-xs text-gray-400 mt-1">{photo.event}</p>
                </div>
                {photo.aiProcessed && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-medium text-purple-600 shadow-sm backdrop-blur-sm">
                    <Sparkles className="h-3 w-3" />
                    AI分類済み
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Button size="sm" variant="secondary" className="shadow-lg">
                    <Download className="h-3.5 w-3.5" />
                    ダウンロード
                  </Button>
                </div>
              </div>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {photo.event}
                  </span>
                  <span className="text-xs text-gray-400">{photo.date}</span>
                </div>
                {photo.detectedChildren.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {photo.detectedChildren.map((child) => (
                      <span
                        key={child}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                      >
                        <User className="h-2.5 w-2.5" />
                        {child}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">
                    顔認識処理を待っています...
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <Camera className="h-12 w-12 text-gray-300" />
            <p className="mt-3 text-sm text-gray-400">
              該当する写真が見つかりませんでした
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
