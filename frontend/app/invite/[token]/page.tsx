"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { useAcceptInvitation } from "@/lib/hooks";

export default function InviteAcceptPage() {
  const params = useParams();
  const token = params.token as string;
  const user = useAuthStore((s) => s.user);
  const acceptInvitation = useAcceptInvitation();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  function handleAccept() {
    setStatus("loading");
    acceptInvitation.mutate(token, {
      onSuccess: (data) => {
        setStatus("success");
        setMessage(data.message);
      },
      onError: (err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "招待の受諾に失敗しました");
      },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-nursery-yellow/10 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <Sparkles className="h-8 w-8 text-primary-500 mb-2" />
          <CardTitle className="text-xl">スタッフ招待</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {!user ? (
            <>
              <p className="text-sm text-gray-600">
                招待を受諾するには先にログインしてください
              </p>
              <a href={`/login?redirect=/invite/${token}`}>
                <Button className="w-full">ログインして招待を受諾</Button>
              </a>
            </>
          ) : status === "idle" ? (
            <>
              <p className="text-sm text-gray-600">
                <strong>{user.name}</strong> さん、園のスタッフとして招待されています。
              </p>
              <Button onClick={handleAccept} className="w-full">
                招待を受諾する
              </Button>
            </>
          ) : status === "loading" ? (
            <div className="py-4">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-500" />
              <p className="mt-2 text-sm text-gray-500">処理中...</p>
            </div>
          ) : status === "success" ? (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
              <p className="text-sm text-gray-600">{message}</p>
              <a href="/dashboard">
                <Button className="w-full">ダッシュボードへ</Button>
              </a>
            </>
          ) : (
            <>
              <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
              <p className="text-sm text-red-600">{message}</p>
              <a href="/login">
                <Button variant="outline" className="w-full">ログイン画面へ</Button>
              </a>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
