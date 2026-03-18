"use client";

import { useState } from "react";
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
} from "lucide-react";

interface ContactEntry {
  id: string;
  childName: string;
  class: string;
  date: string;
  parentMessage: string;
  parentDetails: {
    temperature: string;
    meal: string;
    sleep: string;
    mood: string;
  };
  teacherReply?: string;
}

const entries: ContactEntry[] = [
  {
    id: "1",
    childName: "田中 はるき",
    class: "ひまわり組",
    date: "2026-03-18",
    parentMessage:
      "昨夜少し咳が出ていました。朝は元気に朝ごはんを食べましたが、日中の様子を教えてください。お薬は持たせていません。",
    parentDetails: {
      temperature: "36.5℃",
      meal: "朝ごはんしっかり食べました",
      sleep: "21:00就寝 → 6:30起床",
      mood: "元気",
    },
    teacherReply: undefined,
  },
  {
    id: "2",
    childName: "佐藤 ゆい",
    class: "さくら組",
    date: "2026-03-18",
    parentMessage:
      "土曜日のお迎えは祖母（佐藤よし子）が行きます。よろしくお願いいたします。",
    parentDetails: {
      temperature: "36.3℃",
      meal: "パンを少し残しました",
      sleep: "20:30就寝 → 7:00起床",
      mood: "少し眠そう",
    },
    teacherReply:
      "承知しました。お祖母様のお迎え、確認しておきます。ゆいちゃんは今日お友達と粘土遊びを楽しんでいました！",
  },
  {
    id: "3",
    childName: "鈴木 そうた",
    class: "ひまわり組",
    date: "2026-03-18",
    parentMessage:
      "お弁当日のお知らせありがとうございました。金曜日、楽しみにしています。",
    parentDetails: {
      temperature: "36.8℃",
      meal: "おかわりしました",
      sleep: "21:30就寝 → 6:00起床",
      mood: "とても元気",
    },
    teacherReply:
      "そうたくんはいつも元気いっぱいですね！今日は園庭でかけっこをして、たくさん走りました。お弁当日、お楽しみに。",
  },
];

export default function ContactBookPage() {
  const [selectedEntry, setSelectedEntry] = useState<ContactEntry | null>(null);
  const [replyText, setReplyText] = useState("");

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">連絡帳</h1>
            <p className="text-sm text-gray-500 mt-1">
              2026年3月18日（水）の連絡帳
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary-500" />
              未返信 1件
            </span>
            <span className="text-gray-300">|</span>
            <span>返信済み 2件</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Entry list */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            {entries.map((entry) => (
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
                      <span className="text-xs text-gray-400">
                        {entry.class}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!entry.teacherReply && (
                        <span className="h-2 w-2 rounded-full bg-primary-500" />
                      )}
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {entry.parentMessage}
                  </p>
                  {entry.teacherReply && (
                    <p className="mt-1 text-xs text-green-600">返信済み</p>
                  )}
                </CardContent>
              </Card>
            ))}
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
                  {/* Parent details */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
                      <Thermometer className="h-4 w-4 text-red-400" />
                      <div>
                        <p className="text-xs text-gray-500">体温</p>
                        <p className="text-sm font-medium">
                          {selectedEntry.parentDetails.temperature}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
                      <Utensils className="h-4 w-4 text-nursery-yellow" />
                      <div>
                        <p className="text-xs text-gray-500">食事</p>
                        <p className="text-sm font-medium">
                          {selectedEntry.parentDetails.meal}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
                      <Moon className="h-4 w-4 text-nursery-blue" />
                      <div>
                        <p className="text-xs text-gray-500">睡眠</p>
                        <p className="text-sm font-medium">
                          {selectedEntry.parentDetails.sleep}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
                      <Smile className="h-4 w-4 text-nursery-green" />
                      <div>
                        <p className="text-xs text-gray-500">機嫌</p>
                        <p className="text-sm font-medium">
                          {selectedEntry.parentDetails.mood}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Parent message */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      保護者からのメッセージ
                    </p>
                    <div className="rounded-lg bg-blue-50 p-4 text-sm text-gray-700">
                      {selectedEntry.parentMessage}
                    </div>
                  </div>

                  {/* Teacher reply */}
                  {selectedEntry.teacherReply ? (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        先生からの返信
                      </p>
                      <div className="rounded-lg bg-green-50 p-4 text-sm text-gray-700">
                        {selectedEntry.teacherReply}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        返信を書く
                      </p>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="園での様子を保護者にお伝えしましょう..."
                        rows={4}
                        className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      />
                      <div className="flex justify-end mt-3">
                        <Button disabled={!replyText.trim()}>
                          <Send className="h-4 w-4" />
                          返信する
                        </Button>
                      </div>
                    </div>
                  )}
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
      </main>
    </div>
  );
}
