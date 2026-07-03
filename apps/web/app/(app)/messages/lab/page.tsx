'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, FlaskConical, Sparkles, TriangleAlert } from 'lucide-react';
import type { LabCaseStatus } from '@odovox/types';
import { AnimatedPage } from '@/components/animated-page';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { EmptyState } from '@/components/ds';
import { ListSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/toast';
import {
  useLabMessageCandidates,
  useLabMessages,
  useReplyLabMessage,
  useResolveLabMessage,
  type LabInboxFilter,
  type LabInboxItem,
} from '@/lib/lab-inbox-queries';
import { labStatusStyle } from '@/lib/lab-ui';
import { cn } from '@/lib/utils';

const FILTERS: Array<{ label: string; value: LabInboxFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Needs action', value: 'needs_action' },
  { label: 'With case', value: 'with_case' },
  { label: 'Unlinked', value: 'unlinked' },
];

const QUICK_STATUSES: LabCaseStatus[] = ['ACKNOWLEDGED', 'IN_PROGRESS', 'READY', 'DISPATCHED', 'ISSUE_RAISED'];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** One inbox card — §2.12: message + the parser's verdict + one-tap resolutions. */
function MessageCard({ item, onLink }: { item: LabInboxItem; onLink: (item: LabInboxItem) => void }) {
  const router = useRouter();
  const toast = useToast();
  const resolve = useResolveLabMessage();
  const suggestion = item.llmSuggestion;

  async function act(body: Parameters<typeof resolve.mutateAsync>[0]['body'], success: string) {
    try {
      await resolve.mutateAsync({ id: item.id, body });
      toast.success(success);
    } catch (err) {
      toast.apiError(err);
    }
  }

  return (
    <div className={cn('space-y-2.5 rounded-xl border border-border bg-surface p-3.5 shadow-elev-1', item.resolved && 'opacity-60')}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <FlaskConical className="size-4 shrink-0 text-tool-lab" />
          <span className="truncate text-sm font-semibold text-ink">{item.vendorName}</span>
        </span>
        <span className="shrink-0 text-xs text-text-subtle">{relativeTime(item.createdAt)}</span>
      </div>

      {item.body ? <p className="text-sm text-text-muted">“{item.body}”</p> : null}
      {item.mediaUrls.filter(Boolean).length > 0 ? (
        <div className="flex gap-2">
          {item.mediaUrls.filter((u): u is string => !!u).map((url, i) => (
            <img key={i} src={url} alt="From lab" className="size-16 rounded-lg border border-border object-cover" />
          ))}
        </div>
      ) : null}

      {/* Parser verdict box — green (auto-applied), amber (AI suggestion), or manual. */}
      {item.resolved && item.labCase && item.parseTier ? (
        <div className="rounded-lg bg-sage-tint p-2.5 text-xs">
          <p className="flex items-center gap-1.5 font-semibold text-sage-deep">
            <Check className="size-3.5" /> Auto-detected: {item.labCase.caseCode ?? '—'} → {labStatusStyle(item.labCase.status as LabCaseStatus).label}
          </p>
          <p className="mt-0.5 text-text-muted">
            {item.labCase.patientName} · {item.labCase.type.replaceAll('_', ' ').toLowerCase()} tooth {item.labCase.teeth.join(', ')} ·{' '}
            {item.parseTier === 'button' ? 'button reply' : item.parseTier === 'case_code' ? 'case code match' : `AI · ${Math.round((item.parseConfidence ?? 0) * 100)}%`}
          </p>
          <button type="button" onClick={() => router.push(`/lab/${item.labCase!.id}`)} className="mt-1 font-medium text-sage-deep underline-offset-2 hover:underline">
            View case →
          </button>
        </div>
      ) : null}

      {!item.resolved && suggestion?.newStatus ? (
        <div className="rounded-lg bg-peach-soft/60 p-2.5 text-xs">
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            <Sparkles className="size-3.5" /> AI suggestion: → {labStatusStyle(suggestion.newStatus as LabCaseStatus).label}
            <span className="font-normal text-text-muted">· {Math.round(suggestion.confidence * 100)}%</span>
          </p>
          {suggestion.issueRaised ? <p className="mt-0.5 text-text-muted">“{suggestion.issueRaised}”</p> : null}
          <div className="mt-2 flex gap-2">
            {suggestion.caseId ? (
              <Button size="sm" onClick={() => void act({ action: 'apply_suggestion' }, 'Applied.')} disabled={resolve.isPending}>
                Apply
              </Button>
            ) : (
              <Button size="sm" onClick={() => onLink(item)}>
                Pick case &amp; apply
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => void act({ action: 'handled' }, 'Ignored.')} disabled={resolve.isPending}>
              Ignore
            </Button>
          </div>
        </div>
      ) : null}

      {!item.resolved && !suggestion?.newStatus ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
            <TriangleAlert className="size-3.5 text-peach-deep" /> Needs manual handling
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onLink(item)}>
              Link to case
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void act({ action: 'handled' }, 'Marked handled.')} disabled={resolve.isPending}>
              Handled
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Link-to-case sheet: pick an open case, optionally a status, or just reply. */
function LinkSheet({ item, onClose }: { item: LabInboxItem | null; onClose: () => void }) {
  const toast = useToast();
  const candidates = useLabMessageCandidates(item?.id ?? null);
  const resolve = useResolveLabMessage();
  const reply = useReplyLabMessage();
  const [caseId, setCaseId] = useState<string | null>(null);
  const [status, setStatus] = useState<LabCaseStatus | null>(null);
  const [replyText, setReplyText] = useState('');
  if (!item) return null;

  async function submit() {
    if (!caseId) return;
    try {
      await resolve.mutateAsync({ id: item!.id, body: { action: 'link', caseId, ...(status ? { newStatus: status } : {}) } });
      toast.success(status ? `Linked & marked ${labStatusStyle(status).label.toLowerCase()}` : 'Linked to case');
      onClose();
    } catch (err) {
      toast.apiError(err);
    }
  }

  async function sendReply() {
    if (!replyText.trim()) return;
    try {
      await reply.mutateAsync({ id: item!.id, text: replyText.trim() });
      toast.success('Reply sent');
      setReplyText('');
    } catch (err) {
      toast.apiError(err);
    }
  }

  return (
    <BottomSheet open onClose={onClose} title={item.vendorName}>
      <div className="flex flex-col gap-3 p-5">
        {item.body ? <p className="text-sm text-text-muted">“{item.body}”</p> : null}

        <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">Link to case</p>
        <div className="max-h-44 space-y-1.5 overflow-y-auto">
          {candidates.data?.items.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCaseId(c.id)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg border p-2.5 text-left text-sm',
                caseId === c.id ? 'border-lime bg-lime-soft' : 'border-border bg-paper-warm',
              )}
            >
              <span className="min-w-0 truncate font-medium text-ink">
                {c.caseCode ?? '—'} · {c.patientName}
              </span>
              <span className="shrink-0 text-xs text-text-muted">{labStatusStyle(c.status as LabCaseStatus).label}</span>
            </button>
          ))}
          {candidates.data?.items.length === 0 ? <p className="py-3 text-center text-xs text-text-muted">No open cases with this lab.</p> : null}
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">Set status (optional)</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(status === s ? null : s)}
              className={cn('rounded-pill px-3 py-1.5 text-xs font-medium', status === s ? 'bg-lime text-ink' : 'bg-paper-warm text-text-muted')}
            >
              {labStatusStyle(s).label}
            </button>
          ))}
        </div>
        <Button onClick={submit} disabled={!caseId || resolve.isPending} loading={resolve.isPending}>
          Link{status ? ` & mark ${labStatusStyle(status).label.toLowerCase()}` : ''}
        </Button>

        <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-text-subtle">Or reply (24h window)</p>
        <div className="flex items-center gap-2">
          <input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type a reply…"
            className="h-11 flex-1 rounded-lg border border-border bg-paper-warm px-3 text-sm outline-none focus:border-border-strong"
          />
          <Button size="sm" variant="outline" onClick={sendReply} loading={reply.isPending} disabled={!replyText.trim()}>
            Send
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

export default function LabInboxPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<LabInboxFilter>('needs_action');
  const [linking, setLinking] = useState<LabInboxItem | null>(null);
  const messages = useLabMessages(filter);
  const items = messages.data?.items ?? [];

  return (
    <AnimatedPage className="flex flex-1 flex-col gap-4 px-5 pt-4 pb-28">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => router.push('/messages')} aria-label="Back" className="flex size-9 items-center justify-center rounded-pill hover:bg-muted">
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="text-lg font-semibold">Lab conversations</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn('rounded-pill px-3 py-1.5 text-xs font-medium', filter === f.value ? 'bg-ink text-paper' : 'bg-paper-warm text-text-subtle')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {messages.isLoading ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<FlaskConical className="size-5" />}
          iconTone="sage"
          title={filter === 'needs_action' ? 'Nothing needs you' : 'No lab messages yet'}
          body="Lab replies land here — buttons and clear messages file themselves."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((m) => (
            <MessageCard key={m.id} item={m} onLink={setLinking} />
          ))}
        </div>
      )}

      <LinkSheet item={linking} onClose={() => setLinking(null)} />
    </AnimatedPage>
  );
}
