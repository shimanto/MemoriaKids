"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  UserPlus,
  Users,
  Copy,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  User,
  Briefcase,
  Shield,
} from "lucide-react";
import {
  useStaff,
  useInviteStaff,
  useStaffInvitations,
  useDeactivateStaff,
  type StaffMember,
} from "@/lib/hooks";
import { useAuthStore } from "@/lib/auth";

const AGE_LABELS = ["0歳", "1歳", "2歳", "3歳", "4歳", "5歳", "6歳"];

const employmentLabels: Record<string, string> = {
  full_time: "正社員",
  part_time: "パート",
  temporary: "臨時",
  contract: "契約",
};

const roleLabels: Record<string, string> = {
  lead: "担任",
  sub: "副担任",
  support: "補助",
};

const scopeLabels: Record<string, string> = {
  nursery_wide: "園全体",
  class_only: "担当クラスのみ",
};

export default function StaffPage() {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteType, setInviteType] = useState("full_time");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const { data: staffData, isLoading } = useStaff();
  const { data: invitationsData } = useStaffInvitations();
  const inviteStaff = useInviteStaff();
  const deactivateStaff = useDeactivateStaff();

  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  const staffMembers = staffData?.data ?? [];
  const invitations = invitationsData?.data ?? [];
  const activeStaff = staffMembers.filter((s) => s.profile?.isActive !== false);
  const pendingInvitations = invitations.filter((i) => i.status === "pending");

  function handleInvite() {
    if (!inviteName.trim()) return;
    inviteStaff.mutate(
      { name: inviteName, email: inviteEmail || undefined, employmentType: inviteType },
      {
        onSuccess: (data) => {
          setCopiedUrl(data.inviteUrl);
          setShowInviteForm(false);
          setInviteName("");
          setInviteEmail("");
        },
      },
    );
  }

  function handleCopyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 3000);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">スタッフ管理</h1>
            <p className="text-sm text-gray-500 mt-1">
              保育士・職員の管理と招待
            </p>
          </div>
          <Button onClick={() => setShowInviteForm(true)}>
            <UserPlus className="h-4 w-4" />
            スタッフを招待
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Users className="h-5 w-5 text-primary-500" />
              <div>
                <p className="text-xs text-gray-500">在籍スタッフ</p>
                <p className="text-xl font-bold">{activeStaff.length}名</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-xs text-gray-500">招待中</p>
                <p className="text-xl font-bold">{pendingInvitations.length}件</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Briefcase className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-gray-500">正社員</p>
                <p className="text-xl font-bold">
                  {activeStaff.filter((s) => s.profile?.employmentType === "full_time").length}名
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invite Form Modal */}
        {showInviteForm && (
          <Card className="mb-6 border-primary-200">
            <CardHeader>
              <CardTitle className="text-lg">新しいスタッフを招待</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">名前 *</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="山田 花子"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">メールアドレス（任意）</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="hanako@example.com"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">雇用形態</label>
                <select
                  value={inviteType}
                  onChange={(e) => setInviteType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="full_time">正社員</option>
                  <option value="part_time">パート</option>
                  <option value="temporary">臨時</option>
                  <option value="contract">契約</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleInvite} disabled={inviteStaff.isPending || !inviteName.trim()}>
                  {inviteStaff.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  招待リンクを発行
                </Button>
                <Button variant="outline" onClick={() => setShowInviteForm(false)}>
                  キャンセル
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Copied URL notification */}
        {copiedUrl && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="flex items-center gap-3 p-4">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-800">招待リンクを発行しました</p>
                <p className="text-xs text-green-600 truncate">{copiedUrl}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleCopyUrl(copiedUrl)}>
                <Copy className="h-3.5 w-3.5" />
                コピー
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Staff List */}
        <Card>
          <CardHeader>
            <CardTitle>スタッフ一覧</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
              </div>
            ) : activeStaff.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                スタッフが登録されていません
              </div>
            ) : (
              <div className="space-y-3">
                {activeStaff.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 rounded-lg border p-4 hover:bg-gray-50"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-primary-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{member.name}</p>
                        {member.role === "nursery_admin" && (
                          <span className="flex items-center gap-0.5 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                            <Shield className="h-2.5 w-2.5" />
                            管理者
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{member.email}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {member.profile && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                            {employmentLabels[member.profile.employmentType] ?? member.profile.employmentType}
                          </span>
                        )}
                        {member.profile?.scope && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600">
                            {scopeLabels[member.profile.scope] ?? member.profile.scope}
                          </span>
                        )}
                        {member.classAssignments.map((ca) => (
                          <span
                            key={ca.classId}
                            className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] text-green-700"
                          >
                            {ca.className} ({roleLabels[ca.role] ?? ca.role})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">招待中</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingInvitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{inv.name}</p>
                      <p className="text-xs text-gray-500">
                        {inv.email ?? "メール未設定"} · {employmentLabels[inv.employmentType]} ·
                        期限: {new Date(inv.expiresAt).toLocaleDateString("ja-JP")}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      <Clock className="h-3 w-3" />
                      招待中
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
