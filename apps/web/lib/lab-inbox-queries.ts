'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api-client';
import type { LabCaseStatus } from '@odovox/types';

/** Phase 9.7 §2.12 — reception lab inbox data layer. */

export type LabInboxFilter = 'all' | 'needs_action' | 'with_case' | 'unlinked';

export interface LabInboxSuggestion {
  caseId: string | null;
  caseCode: string | null;
  newStatus: string | null;
  confidence: number;
  issueRaised: string | null;
}

export interface LabInboxItem {
  id: string;
  vendorId: string | null;
  vendorName: string;
  body: string | null;
  parseTier: string | null;
  parseConfidence: number | null;
  resolved: boolean;
  llmSuggestion: LabInboxSuggestion | null;
  labCase: { id: string; caseCode: string | null; type: string; teeth: number[]; status: string; patientName: string } | null;
  mediaUrls: Array<string | null>;
  createdAt: string;
}

export function useLabMessages(filter: LabInboxFilter) {
  return useQuery({
    queryKey: ['lab-messages', filter],
    queryFn: () => api.get<{ items: LabInboxItem[] }>(`/lab/messages?filter=${filter}`),
  });
}

export interface LabCaseCandidate {
  id: string;
  caseCode: string | null;
  type: string;
  teeth: number[];
  status: string;
  patientName: string;
}

export function useLabMessageCandidates(messageId: string | null) {
  return useQuery({
    queryKey: ['lab-message-candidates', messageId],
    queryFn: () => api.get<{ items: LabCaseCandidate[] }>(`/lab/messages/${messageId}/candidates`),
    enabled: !!messageId,
  });
}

export function useResolveLabMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { action: 'link'; caseId: string; newStatus?: LabCaseStatus } | { action: 'apply_suggestion' } | { action: 'handled' } }) =>
      api.post<{ resolved: boolean }>(`/lab/messages/${id}/resolve`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-messages'] });
      qc.invalidateQueries({ queryKey: ['lab-cases'] });
      qc.invalidateQueries({ queryKey: ['lab-case'] });
    },
  });
}

export function useReplyLabMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => api.post(`/lab/messages/${id}/reply`, { text }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lab-messages'] }),
  });
}

export function useUndoLabEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.post<{ caseId: string; status: string }>(`/lab/events/${eventId}/undo`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-case'] });
      qc.invalidateQueries({ queryKey: ['lab-cases'] });
      qc.invalidateQueries({ queryKey: ['lab-messages'] });
    },
  });
}

export interface LabVendorAnalytics {
  windowDays: number;
  turnaroundDaysAvg: number | null;
  targetTurnaroundDays: number;
  onTimeRate: number | null;
  overdueOpenCount: number;
  volume90: number;
  volume30: number;
  issuesRaised: number;
  issueRate: number | null;
  medianReplyHours: number | null;
  monthCostPaise: number;
  costPerCasePaise: number;
}

export function useLabVendorAnalytics(vendorId: string | null) {
  return useQuery({
    queryKey: ['lab-vendor-analytics', vendorId],
    queryFn: () => api.get<LabVendorAnalytics>(`/lab/vendors/${vendorId}/analytics`),
    enabled: !!vendorId,
  });
}
