"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LogIn,
  LogOut,
  ArrowLeft,
  CheckCircle2,
  Clock,
  QrCode,
  Loader2,
  User,
} from "lucide-react";
import {
  useAttendance,
  useCheckIn,
  useCheckOut,
  useClasses,
  type AttendanceRecord,
  type SiblingInfo,
} from "@/lib/hooks";
import { useAuthStore } from "@/lib/auth";
import { SiblingBatchDialog } from "@/components/attendance/sibling-batch-dialog";
import { QrScanner } from "@/components/attendance/qr-scanner";

const AGE_LABELS = ["0歳児", "1歳児", "2歳児", "3歳児", "4歳児", "5歳児", "6歳児"];

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function TouchPanelPage() {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [siblingDialog, setSiblingDialog] = useState<{
    siblings: SiblingInfo[];
    childName: string;
  } | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading } = useAttendance({ from: today });
  const { data: classesData } = useClasses();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  const records = data?.data ?? [];
  const classes = classesData?.data ?? [];

  // 選択したクラスの園児一覧（出欠付き）
  const classChildren = useMemo(() => {
    if (!selectedClassId) return [];
    const cls = classes.find((c) => c.id === selectedClassId);
    if (!cls) return [];

    return cls.children.map((child) => {
      const record = records.find((r) => r.childId === child.id);
      return {
        ...child,
        status: record?.status ?? ("not_yet" as const),
        recordId: record?.id ?? null,
        checkInTime: record?.checkInTime ?? null,
        checkOutTime: record?.checkOutTime ?? null,
      };
    });
  }, [selectedClassId, classes, records]);

  function handleTapChild(child: typeof classChildren[0]) {
    if (!user?.nurseryId) return;

    if (child.status === "not_yet" || !child.recordId) {
      // 登園打刻
      checkIn.mutate(
        { childId: child.id, nurseryId: user.nurseryId, method: "manual" },
        {
          onSuccess: (data) => {
            const siblings = data?.siblings ?? [];
            if (siblings.length > 0) {
              setSiblingDialog({ siblings, childName: child.name });
            }
          },
        },
      );
    } else if (child.status === "checked_in") {
      // 降園打刻
      checkOut.mutate({ recordId: child.recordId });
    }
  }

  function handleQrSuccess(data: unknown) {
    const response = data as { siblings?: SiblingInfo[] };
    if (response?.siblings && response.siblings.length > 0) {
      setSiblingDialog({ siblings: response.siblings, childName: "QR登園" });
    }
  }

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // クラス選択画面
  if (!selectedClassId) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">登降園タッチパネル</h1>
              <p className="text-lg text-gray-500 mt-1">{today} {timeStr}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="lg" onClick={() => setShowQr(true)}>
                <QrCode className="h-5 w-5" />
                QRスキャン
              </Button>
              <a href="/attendance">
                <Button variant="outline" size="lg">
                  <ArrowLeft className="h-5 w-5" />
                  管理画面
                </Button>
              </a>
            </div>
          </div>

          <p className="text-lg text-gray-600 mb-4">クラスを選んでください</p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => {
              const classRecords = records.filter((r) => r.classId === cls.id);
              const checkedIn = classRecords.filter((r) => r.status === "checked_in").length;
              return (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className="rounded-2xl bg-white p-6 shadow-sm border-2 border-transparent hover:border-primary-500 hover:shadow-md transition-all text-left"
                >
                  <div className="text-2xl font-bold text-gray-900">{cls.name}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {AGE_LABELS[cls.ageGroup] ?? `${cls.ageGroup}歳`}
                  </div>
                  <div className="flex items-center gap-4 mt-4">
                    <span className="text-sm text-gray-600">
                      {cls.childCount}名
                    </span>
                    <span className="text-sm text-green-600 font-medium">
                      登園 {checkedIn}名
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {classes.length === 0 && !isLoading && (
            <div className="text-center py-16 text-gray-400">
              クラスが登録されていません。管理画面からクラスを作成してください。
            </div>
          )}
        </div>

        {showQr && user?.nurseryId && (
          <QrScanner nurseryId={user.nurseryId} onSuccess={handleQrSuccess} onClose={() => setShowQr(false)} />
        )}
        {siblingDialog && user?.nurseryId && (
          <SiblingBatchDialog siblings={siblingDialog.siblings} nurseryId={user.nurseryId} checkedInChildName={siblingDialog.childName} onClose={() => setSiblingDialog(null)} />
        )}
      </div>
    );
  }

  // 園児タッチ画面
  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedClassId(null)}
              className="rounded-full bg-white p-2 shadow-sm hover:bg-gray-50"
            >
              <ArrowLeft className="h-6 w-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedClass?.name}
                <span className="ml-2 text-base font-normal text-gray-500">
                  {AGE_LABELS[selectedClass?.ageGroup ?? 0]}
                </span>
              </h1>
              <p className="text-sm text-gray-500">{today} {timeStr}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setShowQr(true)}>
            <QrCode className="h-4 w-4" />
            QRスキャン
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {classChildren.map((child) => {
              const isCheckedIn = child.status === "checked_in";
              const isCheckedOut = child.status === "checked_out";
              const isNotYet = child.status === "not_yet";

              return (
                <button
                  key={child.id}
                  onClick={() => handleTapChild(child)}
                  disabled={isCheckedOut || checkIn.isPending || checkOut.isPending}
                  className={`relative rounded-2xl p-4 text-center transition-all shadow-sm border-2 ${
                    isCheckedIn
                      ? "bg-green-50 border-green-300 hover:border-green-500"
                      : isCheckedOut
                        ? "bg-blue-50 border-blue-200 opacity-60 cursor-default"
                        : "bg-white border-gray-200 hover:border-primary-500 hover:shadow-md"
                  }`}
                >
                  {/* Avatar */}
                  <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                    isCheckedIn
                      ? "bg-green-100 text-green-700"
                      : isCheckedOut
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-400"
                  }`}>
                    {child.avatarUrl ? (
                      <img src={child.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <User className="h-8 w-8" />
                    )}
                  </div>

                  {/* Name */}
                  <p className="mt-2 text-sm font-bold text-gray-900 truncate">
                    {child.name}
                  </p>

                  {/* Status */}
                  <div className="mt-1">
                    {isCheckedIn && (
                      <div className="flex items-center justify-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        {formatTime(child.checkInTime)}
                        <span className="text-gray-400 ml-1">タップで降園</span>
                      </div>
                    )}
                    {isCheckedOut && (
                      <div className="flex items-center justify-center gap-1 text-xs text-blue-500">
                        <Clock className="h-3 w-3" />
                        {formatTime(child.checkInTime)} → {formatTime(child.checkOutTime)}
                      </div>
                    )}
                    {isNotYet && (
                      <p className="text-xs text-gray-400">タップで登園</p>
                    )}
                  </div>

                  {/* Action indicator */}
                  {!isCheckedOut && (
                    <div className={`absolute top-2 right-2 h-3 w-3 rounded-full ${
                      isCheckedIn ? "bg-green-500" : "bg-gray-300"
                    }`} />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {classChildren.length === 0 && !isLoading && (
          <div className="text-center py-16 text-gray-400">
            このクラスに園児が登録されていません
          </div>
        )}
      </div>

      {showQr && user?.nurseryId && (
        <QrScanner nurseryId={user.nurseryId} onSuccess={handleQrSuccess} onClose={() => setShowQr(false)} />
      )}
      {siblingDialog && user?.nurseryId && (
        <SiblingBatchDialog siblings={siblingDialog.siblings} nurseryId={user.nurseryId} checkedInChildName={siblingDialog.childName} onClose={() => setSiblingDialog(null)} />
      )}
    </div>
  );
}
