'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api-client';
import type {
  CreateLabCaseInput,
  CreateLabVendorInput,
  LabCaseResponse,
  LabCaseStatus,
  LabCaseSummary,
  LabVendorResponse,
} from '@odovox/types';

interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export interface LabCaseFilters {
  status?: LabCaseStatus;
  vendorId?: string;
  patientId?: string;
  search?: string;
}

export function useLabCases(filters: LabCaseFilters) {
  return useInfiniteQuery({
    queryKey: ['lab-cases', filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (filters.status) params.set('status', filters.status);
      if (filters.vendorId) params.set('vendorId', filters.vendorId);
      if (filters.patientId) params.set('patientId', filters.patientId);
      if (filters.search) params.set('search', filters.search);
      if (pageParam) params.set('cursor', pageParam);
      return api.get<Paginated<LabCaseSummary>>(`/lab/cases?${params.toString()}`);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useLabCase(id: string) {
  return useQuery({
    queryKey: ['lab-case', id],
    queryFn: () => api.get<LabCaseResponse>(`/lab/cases/${id}`),
    enabled: !!id,
  });
}

export function useCreateLabCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLabCaseInput) => api.post<LabCaseResponse>('/lab/cases', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lab-cases'] }),
  });
}

export function useUpdateLabCase(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch<LabCaseResponse>(`/lab/cases/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-case', id] });
      qc.invalidateQueries({ queryKey: ['lab-cases'] });
    },
  });
}

/** A status transition (send/receive/deliver/…) or cancel/rework, with an optional body. */
export function useLabCaseAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, body }: { action: string; body?: unknown }) =>
      api.post<LabCaseResponse>(`/lab/cases/${id}/${action}`, body ?? {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-case', id] });
      qc.invalidateQueries({ queryKey: ['lab-cases'] });
      qc.invalidateQueries({ queryKey: ['needs-you'] });
    },
  });
}

export function useLabVendors() {
  return useQuery({
    queryKey: ['lab-vendors'],
    queryFn: () => api.get<{ items: LabVendorResponse[] }>('/lab/vendors'),
  });
}

export function useCreateLabVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLabVendorInput) => api.post<LabVendorResponse>('/lab/vendors', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lab-vendors'] }),
  });
}

export interface LabPhoto {
  id: string;
  url: string | null;
  mimeType: string;
  uploadedAt: string;
}

export function useLabPhotos(caseId: string) {
  return useQuery({
    queryKey: ['lab-photos', caseId],
    queryFn: () => api.get<{ items: LabPhoto[] }>(`/lab/cases/${caseId}/photos`),
    enabled: !!caseId,
  });
}

/** Full lab-photo upload: presign → PUT to storage → attach the Media row. */
export function useUploadLabPhoto(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const { uploadUrl, storageKey } = await api.post<{ uploadUrl: string; storageKey: string }>(
        `/lab/cases/${caseId}/photos/presign`,
        { mimeType: file.type },
      );
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      return api.post(`/lab/cases/${caseId}/photos`, {
        storageKey,
        mimeType: file.type,
        sizeBytes: file.size,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-photos', caseId] });
      qc.invalidateQueries({ queryKey: ['lab-case', caseId] });
    },
  });
}

/** Detail fetch — reveals the decrypted vendor phone/address (audited server-side). */
export function useLabVendorDetail(vendorId: string | null) {
  return useQuery({
    queryKey: ['lab-vendor', vendorId],
    queryFn: () => api.get<LabVendorResponse>(`/lab/vendors/${vendorId}`),
    enabled: !!vendorId,
  });
}
