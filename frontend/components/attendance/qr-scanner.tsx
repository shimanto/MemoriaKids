"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, Camera, X, Loader2 } from "lucide-react";
import { useQrCheckIn } from "@/lib/hooks";

interface QrScannerProps {
  nurseryId: string;
  onSuccess: (data: unknown) => void;
  onClose: () => void;
}

export function QrScanner({ nurseryId, onSuccess, onClose }: QrScannerProps) {
  const [manualToken, setManualToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const qrCheckIn = useQrCheckIn();

  function handleSubmitToken() {
    if (!manualToken.trim()) return;
    setError(null);

    qrCheckIn.mutate(
      { token: manualToken.trim(), nurseryId },
      {
        onSuccess: (data) => {
          onSuccess(data);
          onClose();
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "QR読み取りに失敗しました");
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <QrCode className="h-5 w-5 text-primary-500" />
              QRコード読み取り
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Camera placeholder - real implementation would use a QR scanning library */}
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8">
            <Camera className="h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500 text-center">
              カメラでQRコードをスキャン
            </p>
            <p className="text-xs text-gray-400 mt-1">
              （カメラ連携は実装予定）
            </p>
          </div>

          {/* Manual token input as fallback */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              トークンを手動入力
            </label>
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="QRコードのトークンを入力..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <Button
            onClick={handleSubmitToken}
            disabled={qrCheckIn.isPending || !manualToken.trim()}
            className="w-full"
          >
            {qrCheckIn.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <QrCode className="h-4 w-4" />
            )}
            QRコードで登園
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
