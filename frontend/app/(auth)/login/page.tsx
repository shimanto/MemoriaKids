"use client";

import { useState } from "react";
import { Sparkles, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "ログインに失敗しました");
      }

      const { token } = await res.json();
      localStorage.setItem("auth_token", token);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-nursery-yellow/10 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-8 w-8 text-primary-500" />
            <span className="text-2xl font-bold text-primary-500">
              MemoriaKids
            </span>
          </div>
          <CardTitle className="text-xl">ログイン</CardTitle>
          <p className="text-sm text-gray-500">
            メールアドレスとパスワードを入力してください
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}
            <Input
              id="email"
              label="メールアドレス"
              type="email"
              placeholder="sensei@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <div className="relative">
              <Input
                id="password"
                label="パスワード"
                type={showPassword ? "text" : "password"}
                placeholder="パスワードを入力"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" className="rounded" />
                ログイン状態を保持
              </label>
              <a href="#" className="text-sm text-primary-500 hover:underline">
                パスワードを忘れた方
              </a>
            </div>
            <Button type="submit" disabled={isLoading} className="w-full mt-2">
              {isLoading ? "ログイン中..." : "ログイン"}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              デモ用: sensei@example.com / password123
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
