"use client";

import { useState } from "react";
import { Sparkles, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/lib/auth";
import { api } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

function SSOButton({ provider, label, bgColor, textColor, icon }: {
  provider: string;
  label: string;
  bgColor: string;
  textColor: string;
  icon: React.ReactNode;
}) {
  function handleClick() {
    window.location.href = `${API_BASE}/api/auth/sso/${provider}`;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full items-center justify-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-opacity hover:opacity-90 ${bgColor} ${textColor}`}
    >
      {icon}
      {label}
    </button>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const setAuth = useAuthStore((s) => s.setAuth);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await api.post<{
        user: {
          id: string;
          email: string;
          name: string;
          role: "parent" | "nursery_admin" | "nursery_staff" | "super_admin";
          nurseryId: string | null;
        };
        token: string;
      }>("/api/auth/login", { email, password });

      setAuth(res.user, res.token);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
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
            お好みの方法でログインしてください
          </p>
        </CardHeader>
        <CardContent>
          {/* SSO Buttons */}
          <div className="flex flex-col gap-3 mb-6">
            <SSOButton
              provider="line"
              label="LINEでログイン"
              bgColor="bg-[#06C755]"
              textColor="text-white"
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
              }
            />
            <SSOButton
              provider="apple"
              label="Appleでログイン"
              bgColor="bg-black"
              textColor="text-white"
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
              }
            />
            <SSOButton
              provider="google"
              label="Googleでログイン"
              bgColor="bg-white border border-gray-300"
              textColor="text-gray-700"
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              }
            />
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400">または</span>
            </div>
          </div>

          {/* Email/Password form */}
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
              {isLoading ? "ログイン中..." : "メールアドレスでログイン"}
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
