"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Check, X, Loader2 } from "lucide-react";
import { useBatchCheckIn, type SiblingInfo } from "@/lib/hooks";

interface SiblingBatchDialogProps {
  siblings: SiblingInfo[];
  nurseryId: string;
  checkedInChildName: string;
  onClose: () => void;
}

export function SiblingBatchDialog({
  siblings,
  nurseryId,
  checkedInChildName,
  onClose,
}: SiblingBatchDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(siblings.map((s) => s.childId)),
  );
  const batchCheckIn = useBatchCheckIn();

  if (siblings.length === 0) return null;

  function toggleChild(childId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(childId)) {
        next.delete(childId);
      } else {
        next.add(childId);
      }
      return next;
    });
  }

  function handleBatchCheckIn() {
    const childIds = Array.from(selected);
    if (childIds.length === 0) {
      onClose();
      return;
    }
    batchCheckIn.mutate(
      { childIds, nurseryId },
      { onSuccess: onClose, onError: onClose },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary-500" />
            兄弟もまとめて登園しますか？
          </CardTitle>
          <p className="text-sm text-gray-500">
            {checkedInChildName}の兄弟が見つかりました
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {siblings.map((sibling) => (
            <label
              key={sibling.childId}
              className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selected.has(sibling.childId)}
                onChange={() => toggleChild(sibling.childId)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="font-medium text-gray-900">
                {sibling.childName}
              </span>
            </label>
          ))}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleBatchCheckIn}
              disabled={batchCheckIn.isPending}
              className="flex-1"
            >
              {batchCheckIn.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              まとめて登園 ({selected.size}名)
            </Button>
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4" />
              スキップ
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
