'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, MessageCircle, Plus } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { ProfileButton } from '@/components/app-shell/profile-button';
import { EditorialHeading, EmptyState, FAB } from '@/components/ds';
import { ListSkeleton } from '@/components/ui/skeleton';
import { useConversations, type InboxStatusFilter } from '@/lib/whatsapp-queries';
import { categoryMeta, conversationStatusLabel } from '@/lib/whatsapp-ui';
import type { ConversationCategory, ConversationListItem } from '@odovox/types';
import { cn } from '@/lib/utils';
import { ComposeSheet } from './compose-sheet';

interface FilterDef {
  label: string;
  status: InboxStatusFilter;
  category?: ConversationCategory;
}

const FILTERS: FilterDef[] = [
  { label: 'All', status: 'ALL' },
  { label: 'Open', status: 'OPEN' },
  { label: 'Reschedule', status: 'ALL', category: 'RESCHEDULE_REQUEST' },
  { label: 'Complaint', status: 'ALL', category: 'COMPLAINT' },
  { label: 'Resolved', status: 'RESOLVED' },
];

function relativeTime(iso: string | Date | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function ConversationRow({ c, onClick }: { c: ConversationListItem; onClick: () => void }) {
  const cat = categoryMeta(c.category);
  const unread = c.unreadCount > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left shadow-elev-1 transition-shadow active:shadow-elev-2"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-soft text-xs font-semibold text-ink">
        {initials(c.patientName)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center justify-between gap-2">
          <span className={cn('truncate text-sm', unread ? 'font-bold text-ink' : 'font-semibold')}>{c.patientName}</span>
          <span className="shrink-0 text-xs text-text-subtle">{relativeTime(c.lastMessageAt)}</span>
        </span>
        <span className={cn('truncate text-xs', unread ? 'font-medium text-text-subtle' : 'text-muted-foreground')}>
          {c.lastMessagePreview ?? '—'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('size-1.5 rounded-full', cat.dot)} />
          <span className="text-[11px] font-medium uppercase tracking-wide text-text-subtle">
            {cat.label} · {conversationStatusLabel(c.status)}
          </span>
          {unread ? (
            <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-lime px-1.5 text-[11px] font-bold text-ink">
              {c.unreadCount}
            </span>
          ) : null}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-text-subtle" />
    </button>
  );
}

export default function MessagesPage() {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  const filter = FILTERS[active]!;
  const query = useConversations({ status: filter.status, category: filter.category });
  const conversations = query.data ?? [];

  return (
    <AnimatedPage className="flex flex-1 flex-col gap-4 px-5 pt-6 pb-28">
      <EditorialHeading title="Messages" trailing={<ProfileButton />} />

      {/* Lab conversations live in their own inbox (Phase 9.7 §2.12) — different lifecycle. */}
      <button
        type="button"
        onClick={() => router.push('/messages/lab')}
        className="flex items-center justify-between rounded-xl border border-border bg-lavender-soft/50 px-4 py-3 text-left shadow-elev-1"
      >
        <span className="text-sm font-semibold text-ink">Lab conversations</span>
        <ChevronRight className="size-4 text-text-subtle" />
      </button>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f, i) => (
          <button
            key={f.label}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              'rounded-pill px-3 py-1.5 text-xs font-medium transition-colors',
              active === i ? 'bg-ink text-paper' : 'bg-paper-warm text-text-subtle',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <ListSkeleton />
      ) : conversations.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<MessageCircle className="size-5" />}
          title="No conversations here"
          body="Patient replies to your WhatsApp messages land in this inbox — reply within 24 hours."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {conversations.map((c) => (
            <ConversationRow key={c.id} c={c} onClick={() => router.push(`/messages/${c.id}`)} />
          ))}
        </div>
      )}

      <FAB icon={<Plus className="size-5" />} label="New message" onClick={() => setComposeOpen(true)} />
      {composeOpen ? <ComposeSheet onClose={() => setComposeOpen(false)} /> : null}
    </AnimatedPage>
  );
}
