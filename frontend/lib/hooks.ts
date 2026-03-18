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
  date: string;
  status: "checked_in" | "checked_out" | "absent";
  checkInTime: string | null;
  checkOutTime: string | null;
  notes: string | null;
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
    mutationFn: (body: { childId: string; nurseryId: string; notes?: string }) =>
      api.post<{ data: AttendanceRecord }>("/api/attendance/check-in", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { recordId: string; notes?: string }) =>
      api.post<{ data: AttendanceRecord }>("/api/attendance/check-out", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
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
};
