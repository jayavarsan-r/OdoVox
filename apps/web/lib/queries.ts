'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { api } from './api-client';
import type {
  CreatePatientInput,
  UpdatePatientInput,
  PatientListItem,
  PatientResponse,
  PatientFilter,
  CreateTreatmentPlanInput,
  CreateManualVisitInput,
  CreatePrescriptionInput,
  CreateMediaInput,
  PresignUploadInput,
  UpsertToothInput,
  NeedsYouItem,
  RecentVisitItem,
  TodayStats,
  TemplateResponse,
  CreateTemplateInput,
  UpdateTemplateInput,
} from '@odovox/types';

interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

// ---- Patients ---------------------------------------------------------------
export function usePatients(search: string, filter: PatientFilter) {
  return useInfiniteQuery({
    queryKey: ['patients', { search, filter }],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ filter, limit: '20' });
      if (search) params.set('search', search);
      if (pageParam) params.set('cursor', pageParam);
      return api.get<Paginated<PatientListItem>>(`/patients?${params.toString()}`);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: ['patient', id],
    queryFn: () => api.get<PatientResponse>(`/patients/${id}`),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePatientInput) => api.post<PatientResponse>('/patients', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patients'] }),
  });
}

export function useUpdatePatient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePatientInput) => api.patch<PatientResponse>(`/patients/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', id] });
      qc.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useDeletePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ deletedAt: string }>(`/patients/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patients'] }),
  });
}

// ---- Teeth ------------------------------------------------------------------
export interface ToothRow {
  id: string;
  toothNumber: number;
  status: string;
  notes: string | null;
  history: { date: string; status: string; by: string | null; notes: string | null }[];
}

export function useTeeth(patientId: string) {
  return useQuery({
    queryKey: ['teeth', patientId],
    queryFn: () => api.get<ToothRow[]>(`/patients/${patientId}/teeth`),
    enabled: !!patientId,
  });
}

export function useUpsertTooth(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tooth, input }: { tooth: number; input: UpsertToothInput }) =>
      api.put(`/patients/${patientId}/teeth/${tooth}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teeth', patientId] }),
  });
}

// ---- Plans ------------------------------------------------------------------
export interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  estimatedCostPaise: number;
  teeth: number[];
  progress: { totalSittings: number; completedSittings: number; percent: number };
}

export function usePlans(patientId: string) {
  return useQuery({
    queryKey: ['plans', patientId],
    queryFn: () => api.get<PlanRow[]>(`/patients/${patientId}/plans`),
    enabled: !!patientId,
  });
}

export interface PlanSitting {
  id: string;
  sittingNumber: number;
  date: string;
  completed: boolean;
  notes: string | null;
  visitId: string | null;
}
export interface PlanProcedureDetail {
  id: string;
  name: string;
  toothNumbers: number[];
  totalSittings: number;
  completedSittings: number;
  status: string;
  sittings: PlanSitting[];
}
export interface PlanDetail {
  id: string;
  patientId: string;
  name: string;
  description: string | null;
  status: string;
  estimatedCostPaise: number;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  progress: { totalSittings: number; completedSittings: number; percent: number };
  procedures: PlanProcedureDetail[];
  prescriptions: { id: string; createdAt: string; medicines: unknown }[];
  xrayCount: number;
}

export function usePlan(planId: string) {
  return useQuery({
    queryKey: ['plan', planId],
    queryFn: () => api.get<PlanDetail>(`/plans/${planId}`),
    enabled: !!planId,
  });
}

export function useCompletePlan(planId: string, patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ id: string; status: string }>(`/plans/${planId}/complete`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plan', planId] });
      qc.invalidateQueries({ queryKey: ['plans', patientId] });
    },
  });
}

export function useCancelPlan(planId: string, patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => api.post<{ id: string; status: string }>(`/plans/${planId}/cancel`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plan', planId] });
      qc.invalidateQueries({ queryKey: ['plans', patientId] });
    },
  });
}

export async function fetchPlanPdfUrl(planId: string): Promise<string> {
  const { url } = await api.get<{ url: string }>(`/plans/${planId}/pdf`);
  return url;
}

export function useCreatePlan(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateTreatmentPlanInput, 'patientId'>) =>
      api.post<PlanRow>(`/patients/${patientId}/plans`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans', patientId] }),
  });
}

// ---- Prescription templates -------------------------------------------------
export function useTemplates(search: string) {
  return useQuery({
    queryKey: ['templates', { search }],
    queryFn: () => {
      const qs = search ? `?search=${encodeURIComponent(search)}` : '';
      return api.get<{ items: TemplateResponse[] }>(`/prescription-templates${qs}`);
    },
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTemplateInput) =>
      api.post<TemplateResponse>('/prescription-templates', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useUpdateTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTemplateInput) =>
      api.patch<TemplateResponse>(`/prescription-templates/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useArchiveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/prescription-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export interface AppliedTemplate {
  id: string;
  name: string;
  medicines: TemplateResponse['medicines'];
  instructions: string | null;
  reviewAfterDays: number | null;
  usageCount: number;
}

/** POST /:id/use — bumps usageCount and returns the medicines to populate the sheet. */
export function useApplyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<AppliedTemplate>(`/prescription-templates/${id}/use`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

// ---- Visits -----------------------------------------------------------------
export interface VisitRow {
  id: string;
  status: string;
  chiefComplaint: string | null;
  createdAt: string;
  startedAt: string | null;
}

export function useVisits(patientId: string) {
  return useQuery({
    queryKey: ['visits', patientId],
    queryFn: () => api.get<VisitRow[]>(`/patients/${patientId}/visits`),
    enabled: !!patientId,
  });
}

export function useCreateVisit(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateManualVisitInput) =>
      api.post<VisitRow>(`/patients/${patientId}/visits`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visits', patientId] });
      qc.invalidateQueries({ queryKey: ['patient', patientId] });
    },
  });
}

// ---- Prescriptions ----------------------------------------------------------
export interface PrescriptionRow {
  id: string;
  medicines: { name: string; dosage: string; frequency: string; durationDays: number }[];
  instructions: string | null;
  reviewAfterDays: number | null;
  createdAt: string;
}

export function usePrescriptions(patientId: string) {
  return useQuery({
    queryKey: ['prescriptions', patientId],
    queryFn: () => api.get<PrescriptionRow[]>(`/patients/${patientId}/prescriptions`),
    enabled: !!patientId,
  });
}

export function useCreatePrescription(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreatePrescriptionInput, 'patientId' | 'doctorId'>) =>
      api.post<PrescriptionRow>(`/patients/${patientId}/prescriptions`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prescriptions', patientId] }),
  });
}

// ---- Media ------------------------------------------------------------------
export interface MediaRow {
  id: string;
  type: string;
  mimeType: string;
  notes: string | null;
  uploadedAt: string;
}

export function useMedia(patientId: string) {
  return useQuery({
    queryKey: ['media', patientId],
    queryFn: () => api.get<Paginated<MediaRow>>(`/patients/${patientId}/media`),
    enabled: !!patientId,
  });
}

/** Full direct-to-storage upload: presign → PUT to storage → create the Media row. */
export function useUploadMedia(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      type,
      notes,
    }: {
      file: File;
      type: 'XRAY' | 'PHOTO' | 'DOCUMENT';
      notes?: string;
    }) => {
      const presignInput: PresignUploadInput = {
        filename: file.name,
        mimeType: file.type as PresignUploadInput['mimeType'],
        sizeBytes: file.size,
        patientId,
      };
      const { uploadUrl, storageKey } = await api.post<{ uploadUrl: string; storageKey: string }>(
        '/media/presign',
        presignInput,
      );
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      const createInput: CreateMediaInput = {
        patientId,
        storageKey,
        type,
        mimeType: file.type as CreateMediaInput['mimeType'],
        sizeBytes: file.size,
        notes,
      };
      return api.post<MediaRow>('/media', createInput);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media', patientId] }),
  });
}

export function useDeleteMedia(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/media/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media', patientId] }),
  });
}

export async function fetchMediaUrl(id: string): Promise<string> {
  const { url } = await api.get<{ url: string }>(`/media/${id}/url`);
  return url;
}

export async function fetchPrescriptionPdfUrl(id: string): Promise<string> {
  const { url } = await api.get<{ url: string }>(`/prescriptions/${id}/pdf`);
  return url;
}

// ---- Home -------------------------------------------------------------------
export function useNeedsYou() {
  return useQuery({
    queryKey: ['needs-you'],
    queryFn: () => api.get<{ items: NeedsYouItem[] }>('/home/needs-you'),
  });
}

export function useRecentVisits() {
  return useQuery({
    queryKey: ['recent-visits'],
    queryFn: () => api.get<{ items: RecentVisitItem[] }>('/home/recent'),
  });
}

export function useTodayStats() {
  return useQuery({
    queryKey: ['today-stats'],
    queryFn: () => api.get<TodayStats>('/today/stats'),
  });
}

export interface ActivityItem {
  id: string;
  text: string;
  patientId: string | null;
  at: string;
  withWarning: boolean;
}

/** Receptionist "Recent activity" — audit-derived consultation completions. */
export function useTodayActivity() {
  return useQuery({
    queryKey: ['today-activity'],
    queryFn: () => api.get<{ items: ActivityItem[] }>('/today/activity'),
  });
}
