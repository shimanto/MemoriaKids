"use client";

import { useState, useEffect, useRef } from "react";
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
  Loader2,
} from "lucide-react";
import { usePhotos, useUploadPhoto, type Photo } from "@/lib/hooks";
import { useAuthStore } from "@/lib/auth";

export default function PhotosPage() {
  const [filterChild, setFilterChild] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = usePhotos();
  const uploadPhoto = useUploadPhoto();

  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  const photos = data?.data ?? [];

  const filtered = photos.filter((p) => {
    if (!filterChild) return true;
    return p.caption?.includes(filterChild);
  });

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("photo", file);
    uploadPhoto.mutate(formData);
    e.target.value = "";
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

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
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadPhoto.isPending}
            >
              {uploadPhoto.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              写真をアップロード
            </Button>
          </div>
        </div>

        {/* AI badge */}
        <Card className="mb-6 border-purple-100 bg-gradient-to-r from-purple-50 to-pink-50">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-xl bg-white p-2.5 shadow-sm">
              <Sparkles className="h-6 w-6 text-nursery-purple" />
            </div>
            <div>
              <p className="font-medium text-gray-900">AI顔認識が有効です</p>
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
            <User className="h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="キャプションで絞り込み..."
              value={filterChild}
              onChange={(e) => setFilterChild(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <span className="text-sm text-gray-400">
            {filtered.length}件の写真
          </span>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-gray-500">読み込み中...</span>
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            写真の取得に失敗しました。再度お試しください。
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Camera className="h-12 w-12 text-gray-300" />
            <p className="mt-3 text-sm text-gray-400">
              写真がまだアップロードされていません
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((photo) => (
              <Card key={photo.id} className="overflow-hidden group">
                <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  {photo.url ? (
                    <img
                      src={`${apiBase}${photo.url}`}
                      alt={photo.caption ?? "写真"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-12 w-12 text-gray-300" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-medium text-purple-600 shadow-sm backdrop-blur-sm">
                    <Sparkles className="h-3 w-3" />
                    AI分類済み
                  </div>
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
                      {photo.caption ?? "写真"}
                    </span>
                    <span className="text-xs text-gray-400">
                      {photo.takenAt
                        ? new Date(photo.takenAt).toLocaleDateString("ja-JP")
                        : new Date(photo.createdAt).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
