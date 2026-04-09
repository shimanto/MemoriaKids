"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/lib/auth";

function CallbackContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const token = searchParams.get("token");
    const userParam = searchParams.get("user");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      return;
    }

    if (!token || !userParam) {
      setError("認証情報が取得できませんでした");
      return;
    }

    try {
      const user = JSON.parse(decodeURIComponent(userParam));
      setAuth(user, token);
      window.location.href = "/dashboard";
    } catch {
      setError("認証情報の解析に失敗しました");
    }
  }, [searchParams, setAuth]);

  if (error) {
    return (
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">ログインに失敗しました</h2>
        <p className="text-sm text-gray-600 mb-6">{error}</p>
        <a
          href="/login"
          className="inline-flex items-center justify-center rounded-lg bg-primary-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-600"
        >
          ログイン画面に戻る
        </a>
      </div>
    );
  }

  return (
    <div className="text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-500" />
      <p className="mt-4 text-sm text-gray-500">ログイン処理中...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Suspense
        fallback={
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-500" />
            <p className="mt-4 text-sm text-gray-500">読み込み中...</p>
          </div>
        }
      >
        <CallbackContent />
      </Suspense>
    </div>
  );
}
