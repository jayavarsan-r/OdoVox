'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api-client';
import type {
  ConsentResponse,
  ConversationCategory,
  ConversationDetail,
  ConversationListItem,
  MessageResponse,
  SendMessageInput,
  WhatsAppSettingsResponse,
  WhatsAppTemplateResponse,
} from '@odovox/types';

export function useWhatsAppTemplates() {
  return useQuery({
    queryKey: ['wa-templates'],
    queryFn: () => api.get<WhatsAppTemplateResponse[]>('/whatsapp/templates'),
  });
}

export type InboxStatusFilter = 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export function useConversations(filter: { status: InboxStatusFilter; category?: ConversationCategory }) {
  return useQuery({
    queryKey: ['wa-conversations', filter],
    queryFn: () => {
      const params = new URLSearchParams({ status: filter.status });
      if (filter.category) params.set('category', filter.category);
      return api.get<ConversationListItem[]>(`/whatsapp/conversations?${params.toString()}`);
    },
    refetchInterval: 30_000,
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ['wa-conversation', id],
    queryFn: () => api.get<ConversationDetail>(`/whatsapp/conversations/${id}`),
    enabled: !!id,
  });
}

export function useReply(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.post<MessageResponse>(`/whatsapp/conversations/${id}/reply`, { text }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-conversation', id] });
      qc.invalidateQueries({ queryKey: ['wa-conversations'] });
    },
  });
}

export function useResolveConversation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ConversationListItem>(`/whatsapp/conversations/${id}/resolve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-conversation', id] });
      qc.invalidateQueries({ queryKey: ['wa-conversations'] });
    },
  });
}

export interface SendOutcome {
  messageId: string | null;
  status: string;
  queued: boolean;
  blocked: boolean;
  reason?: string;
}

export function useSendTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SendMessageInput) => api.post<SendOutcome>('/whatsapp/send', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-conversations'] });
      qc.invalidateQueries({ queryKey: ['wa-patient-messages'] });
    },
  });
}

export function usePatientMessages(patientId: string) {
  return useQuery({
    queryKey: ['wa-patient-messages', patientId],
    queryFn: () => api.get<MessageResponse[]>(`/patients/${patientId}/whatsapp/messages`),
    enabled: !!patientId,
  });
}

// --- Consent ---------------------------------------------------------------

export function usePatientConsent(patientId: string) {
  return useQuery({
    queryKey: ['wa-consent', patientId],
    queryFn: () => api.get<ConsentResponse>(`/patients/${patientId}/whatsapp-consent`),
    enabled: !!patientId,
  });
}

export function useSetConsent(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, body }: { action: 'opt-in' | 'opt-out' | 'reconfirm'; body?: unknown }) =>
      api.post<ConsentResponse>(`/patients/${patientId}/whatsapp-consent/${action}`, body ?? {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-consent', patientId] }),
  });
}

// --- Settings (admin) ------------------------------------------------------

export function useWhatsAppSettings() {
  return useQuery({
    queryKey: ['wa-settings'],
    queryFn: () => api.get<WhatsAppSettingsResponse>('/clinic/whatsapp'),
  });
}

export function useToggleTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateKey, isEnabled }: { templateKey: string; isEnabled: boolean }) =>
      api.patch(`/clinic/whatsapp/templates/${templateKey}`, { isEnabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-settings'] }),
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { budgetPaise: number | null; warningThreshold?: number }) => api.patch('/clinic/whatsapp/budget', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-settings'] }),
  });
}
