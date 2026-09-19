'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, FlaskConical, MessageCircle, Plus } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { ProfileButton } from '@/components/app-shell/profile-button';
import { EditorialHeading, EmptyState } from '@/components/ds';
import { Mini } from '@/components/ui/badge';
import { useLabMessages } from '@/lib/lab-inbox-queries';
import { ListSkeleton } from '@/components/ui/skeleton';
import { useConversations, type InboxStatusFilter } from '@/lib/whatsapp-queries';
import { categoryMeta } from '@/lib/whatsapp-ui';
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
          {/*
            Frame 62 carries the category as a DOT beside the time, not a caption. The row used
            to spell out "RESCHEDULE · OPEN" on a third line — restating the filter chips
            directly above it, in the space the message preview needed.

            A resolved conversation says so, because that is the one status that changes
            whether you act. Everything else is simply open, which is what an inbox is.
          */}
          <span className="flex shrink-0 items-center gap-1.5">
            {c.status === 'RESOLVED' ? (
              <Mini tone="live">Resolved</Mini>
            ) : (
              <>
                <span className="text-xs text-text-subtle">{relativeTime(c.lastMessageAt)}</span>
                <span className={cn('size-1.5 rounded-full', cat.dot)} title={cat.label} />
                {unread ? <span className="size-1.5 rounded-full bg-lime" /> : null}
              </>
            )}
          </span>
        </span>
        <span className={cn('truncate text-xs', unread ? 'font-medium text-text-subtle' : 'text-muted-foreground')}>
          {c.lastMessagePreview ?? '—'}
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
  // The lab inbox's own "needs action" filter, counted — the chip states a real backlog
  // rather than decorating the row. Frame 62 shows "2 need action".
  const labNeedsAction = useLabMessages('needs_action').data?.items.length ?? 0;

  return (
    <AnimatedPage className="flex flex-1 flex-col gap-4 px-5 pt-6 pb-28">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Back"
          onClick={() => router.push('/more')}
          className="flex size-9 shrink-0 items-center justify-center rounded-pill hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </button>
        <EditorialHeading
          className="flex-1"
          title="Messages"
          trailing={
            <span className="flex items-center gap-2">
              {/* Frame 62's lime + circle. It replaces a labelled "New message" pill floating
                  at the bottom right — which, for a receptionist, sat beside the dock's own
                  lime +, the duplicate-control problem frame 47 had. */}
              <button
                type="button"
                aria-label="New message"
                onClick={() => setComposeOpen(true)}
                className="flex size-9 items-center justify-center rounded-pill bg-lime text-pine shadow-cta"
              >
                <Plus className="size-[18px]" />
              </button>
              <ProfileButton />
            </span>
          }
        />
      </div>

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

      {/*
        The lab inbox sits BELOW the conversations, as frame 62 has it. It was above them —
        the first thing on a screen called Messages was a door out of it. Patient replies are
        the subject here; the lab is a different lifecycle behind its own door.
      */}
      <button
        type="button"
        onClick={() => router.push('/messages/lab')}
        className="flex items-center gap-3 rounded-2xl bg-white px-[15px] py-3 text-left shadow-elev-1"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-lav-soft text-lav">
          <FlaskConical className="size-[18px]" />
        </span>
        <span className="flex-1 text-[14.5px] font-heavy text-pine">Lab inbox</span>
        {labNeedsAction > 0 ? (
          <Mini tone="warn">{labNeedsAction} need action</Mini>
        ) : null}
        <ChevronRight className="size-[15px] shrink-0 text-pine-3" />
      </button>

      {composeOpen ? <ComposeSheet onClose={() => setComposeOpen(false)} /> : null}
    </AnimatedPage>
  );
}
