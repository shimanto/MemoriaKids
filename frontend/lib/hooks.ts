"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fetcher } from "./api";

// ── Types ──────────────────────────────────────────────

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number };
}

// Attendance
interface AttendanceRecord {
  id: string;
  childId: string;
  childName: string;
  childAvatarUrl: string | null;
  classId: string | null;
  className: string | null;
  ageGroup: number | null;
  date: string;
  status: "checked_in" | "checked_out" | "absent";
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInMethod: string;
  checkOutMethod: string | null;
  notes: string | null;
}

// Classes
interface NurseryClass {
  id: string;
  nurseryId: string;
  name: string;
  ageGroup: number;
  academicYear: number;
  capacity: number | null;
  teacherId: string | null;
  sortOrder: number;
  childCount: number;
  children: Array<{ id: string; name: string; dateOfBirth: string; avatarUrl: string | null }>;
}

interface SiblingInfo {
  childId: string;
  childName: string;
}

interface CheckInResponse {
  data: {
    record: AttendanceRecord;
    siblings: SiblingInfo[];
    alreadyCheckedIn: boolean;
  };
  siblings: SiblingInfo[];
  alreadyCheckedIn: boolean;
}

interface AttendanceSettings {
  id: string;
  nurseryId: string;
  enabledMethods: string[];
  timeWindow: { start: string; end: string } | null;
  bleRssiThreshold: number | null;
  bleDwellSeconds: number | null;
  faceConfidenceThreshold: string | null;
  faceReviewRangeLow: string | null;
  siblingBatchEnabled: boolean;
}

interface BatchCheckInResult {
  batchGroupId: string;
  results: Array<{
    childId: string;
    success: boolean;
    record?: AttendanceRecord;
    alreadyCheckedIn?: boolean;
    error?: string;
  }>;
}

// Contact Book
interface ContactBookEntry {
  id: string;
  childId: string;
  childName: string;
  authorName: string;
  date: string;
  mood: "happy" | "neutral" | "sad" | "tired" | "excited" | null;
  meals: {
    breakfast?: "all" | "most" | "some" | "none";
    lunch?: "all" | "most" | "some" | "none";
    snack?: "all" | "most" | "some" | "none";
  } | null;
  nap: {
    startTime?: string;
    endTime?: string;
    quality?: "good" | "fair" | "poor";
  } | null;
  activities: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Growth
interface GrowthRecord {
  id: string;
  date: string;
  heightCm: number | null;
  weightKg: number | null;
  headCircumferenceCm: number | null;
  notes: string | null;
  createdAt: string;
}

interface GrowthResponse {
  data: GrowthRecord[];
  child: { id: string; name: string; dateOfBirth: string };
  pagination: { page: number; limit: number };
}

// Photos
interface Photo {
  id: string;
  nurseryId: string;
  uploadedBy: string;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  takenAt: string | null;
  isPublic: boolean;
  createdAt: string;
}

// Children (from attendance records, we derive child list)
interface Child {
  id: string;
  name: string;
  className: string;
  nurseryId: string;
}

// Family Group
interface FamilyGroup {
  id: string;
  name: string;
  parentId: string;
  members: SiblingInfo[];
  createdAt: string;
}

// ── Attendance Hooks ───────────────────────────────────

export function useAttendance(params?: { from?: string; childId?: string; page?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.from) searchParams.set("from", params.from);
  if (params?.childId) searchParams.set("childId", params.childId);
  if (params?.page) searchParams.set("page", String(params.page));
  searchParams.set("limit", "100");

  return useQuery({
    queryKey: ["attendance", params],
    queryFn: () =>
      api.get<PaginatedResponse<AttendanceRecord>>(
        `/api/attendance?${searchParams.toString()}`
      ),
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { childId: string; nurseryId: string; method?: string; notes?: string }) =>
      api.post<CheckInResponse>("/api/attendance/check-in", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { recordId: string; method?: string; notes?: string }) =>
      api.post<{ data: AttendanceRecord }>("/api/attendance/check-out", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export function useQrCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { token: string; nurseryId: string }) =>
      api.post<CheckInResponse>("/api/attendance/check-in/qr", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export function useBatchCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { childIds: string[]; nurseryId: string; method?: string }) =>
      api.post<{ data: BatchCheckInResult }>("/api/attendance/check-in/batch", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export function useSiblings(childId: string) {
  return useQuery({
    queryKey: ["siblings", childId],
    queryFn: () =>
      api.get<{ data: SiblingInfo[] }>(`/api/attendance/siblings/${childId}`),
    enabled: !!childId,
  });
}

export function useAttendanceSettings() {
  return useQuery({
    queryKey: ["attendance-settings"],
    queryFn: () =>
      api.get<{ data: AttendanceSettings | null }>("/api/attendance/settings"),
  });
}

export function useUpdateAttendanceSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<AttendanceSettings>) =>
      api.put<{ data: AttendanceSettings }>("/api/attendance/settings", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-settings"] });
    },
  });
}

// ── Family Group Hooks ─────────────────────────────────

export function useFamilyGroups() {
  return useQuery({
    queryKey: ["family-groups"],
    queryFn: () =>
      api.get<{ data: FamilyGroup[] }>("/api/family-groups"),
  });
}

export function useCreateFamilyGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; parentId: string; childIds: string[] }) =>
      api.post<{ data: FamilyGroup }>("/api/family-groups", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-groups"] });
    },
  });
}

export function useDeleteFamilyGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ message: string }>(`/api/family-groups/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-groups"] });
    },
  });
}

// ── Class Hooks ────────────────────────────────────────

export function useClasses(year?: number) {
  const y = year ?? new Date().getFullYear();
  return useQuery({
    queryKey: ["classes", y],
    queryFn: () =>
      api.get<{ data: NurseryClass[] }>(`/api/classes?year=${y}`),
  });
}

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; ageGroup: number; academicYear: number; capacity?: number; teacherId?: string }) =>
      api.post<{ data: NurseryClass }>("/api/classes", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}

export function useAssignChildToClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { childId: string; classId: string | null }) =>
      api.post<{ data: unknown }>("/api/classes/assign", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

// ── Staff Hooks ────────────────────────────────────────

interface StaffMember {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  profile: {
    employmentType: string;
    scope: string;
    qualifications: string | null;
    isActive: boolean;
    startDate: string | null;
    endDate: string | null;
    phone: string | null;
  } | null;
  classAssignments: Array<{
    classId: string;
    className: string;
    ageGroup: number;
    role: string;
  }>;
}

interface StaffInvitation {
  id: string;
  nurseryId: string;
  name: string;
  email: string | null;
  role: string;
  employmentType: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export function useStaff() {
  return useQuery({
    queryKey: ["staff"],
    queryFn: () => api.get<{ data: StaffMember[] }>("/api/staff"),
  });
}

export function useStaffDetail(id: string) {
  return useQuery({
    queryKey: ["staff", id],
    queryFn: () => api.get<{ data: StaffMember }>(`/api/staff/${id}`),
    enabled: !!id,
  });
}

export function useInviteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email?: string; role?: string; employmentType?: string }) =>
      api.post<{ data: StaffInvitation; inviteUrl: string }>("/api/staff/invite", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-invitations"] });
    },
  });
}

export function useStaffInvitations() {
  return useQuery({
    queryKey: ["staff-invitations"],
    queryFn: () => api.get<{ data: StaffInvitation[] }>("/api/staff/invitations/list"),
  });
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (token: string) =>
      api.post<{ message: string }>("/api/staff/invite/accept", { token }),
  });
}

export function useUpdateStaffProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; employmentType?: string; scope?: string; qualifications?: string; isActive?: boolean }) =>
      api.put<{ data: unknown }>(`/api/staff/${id}/profile`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
  });
}

export function useDeactivateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ message: string }>(`/api/staff/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
  });
}

// Promote (year progression)
export function usePromoteClasses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { fromYear: number; toYear: number; copyTeachers?: boolean }) =>
      api.post<{ data: unknown; message: string }>("/api/classes/promote", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
  });
}

// ── Contact Book Hooks ─────────────────────────────────

export function useContactBook(params?: { childId?: string; date?: string; page?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.childId) searchParams.set("childId", params.childId);
  if (params?.date) searchParams.set("date", params.date);
  if (params?.page) searchParams.set("page", String(params.page));
  searchParams.set("limit", "50");

  return useQuery({
    queryKey: ["contact-book", params],
    queryFn: () =>
      api.get<PaginatedResponse<ContactBookEntry>>(
        `/api/contact-book?${searchParams.toString()}`
      ),
  });
}

export function useContactBookEntry(id: string) {
  return useQuery({
    queryKey: ["contact-book", id],
    queryFn: () => api.get<{ data: ContactBookEntry }>(`/api/contact-book/${id}`),
    enabled: !!id,
  });
}

export function useCreateContactBookEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      childId: string;
      date: string;
      mood?: string;
      meals?: Record<string, string>;
      nap?: Record<string, string>;
      activities?: string;
      notes?: string;
    }) => api.post<{ data: ContactBookEntry }>("/api/contact-book", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-book"] });
    },
  });
}

// ── Growth Hooks ───────────────────────────────────────

export function useGrowthRecords(childId: string, page?: number) {
  const searchParams = new URLSearchParams();
  if (page) searchParams.set("page", String(page));
  searchParams.set("limit", "50");

  return useQuery({
    queryKey: ["growth", childId, page],
    queryFn: () =>
      api.get<GrowthResponse>(
        `/api/growth/${childId}?${searchParams.toString()}`
      ),
    enabled: !!childId,
  });
}

export function useAddGrowthRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      childId,
      ...body
    }: {
      childId: string;
      date: string;
      heightCm?: number;
      weightKg?: number;
      headCircumferenceCm?: number;
      notes?: string;
    }) => api.post<{ data: GrowthRecord }>(`/api/growth/${childId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["growth"] });
    },
  });
}

// ── Photos Hooks ───────────────────────────────────────

export function usePhotos(page?: number) {
  const searchParams = new URLSearchParams();
  if (page) searchParams.set("page", String(page));
  searchParams.set("limit", "30");

  return useQuery({
    queryKey: ["photos", page],
    queryFn: () =>
      api.get<PaginatedResponse<Photo>>(
        `/api/photos?${searchParams.toString()}`
      ),
  });
}

export function useUploadPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("auth_token")
          : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"}/api/photos/upload`,
        { method: "POST", headers, body: formData }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Upload failed");
      }
      return res.json() as Promise<{ data: Photo }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["photos"] });
    },
  });
}

// Photo download status
interface DownloadStatus {
  monthlyLimit: number;
  used: number;
  remaining: number;
  viewQuality: number;
  downloadQuality: number | null;
}

export function useDownloadStatus() {
  return useQuery({
    queryKey: ["photo-download-status"],
    queryFn: () =>
      api.get<{ data: DownloadStatus }>("/api/photos/download-status"),
  });
}

export function usePhotoDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photoId: string) => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("auth_token")
          : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"}/api/photos/${photoId}/download`,
        { method: "GET", headers },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Download failed");
      }

      // Trigger browser download
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const fileName = disposition?.match(/filename="(.+)"/)?.[1] ?? `photo-${photoId}.jpg`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["photo-download-status"] });
    },
  });
}

export function useFaceMatchPhotos(childId: string) {
  return useQuery({
    queryKey: ["photos", "face-match", childId],
    queryFn: () =>
      api.get<{ data: Photo[]; childId: string; totalMatches: number }>(
        `/api/photos/face-match/${childId}`
      ),
    enabled: !!childId,
  });
}

// ── Dashboard Stats (composite) ───────────────────────

export function useDashboardStats() {
  const today = new Date().toISOString().slice(0, 10);

  const attendance = useAttendance({ from: today });
  const contactBook = useContactBook({ date: today });

  return {
    attendance,
    contactBook,
    isLoading: attendance.isLoading || contactBook.isLoading,
  };
}

// Export types
export type {
  AttendanceRecord,
  ContactBookEntry,
  GrowthRecord,
  GrowthResponse,
  Photo,
  Child,
  PaginatedResponse,
  SiblingInfo,
  CheckInResponse,
  AttendanceSettings,
  BatchCheckInResult,
  FamilyGroup,
  DownloadStatus,
  NurseryClass,
  StaffMember,
  StaffInvitation,
};
