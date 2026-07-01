'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CalendarClock, Check, Clock, Send } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { GlassCard } from '@/components/ds';
import { ListSkeleton } from '@/components/ui/skeleton';
import { useConversation, useReply, useResolveConversation } from '@/lib/whatsapp-queries';
import { messageStatusLabel, messageStatusTone, windowCountdown, windowOpen } from '@/lib/whatsapp-ui';
import { useToast } from '@/lib/toast';
import type { MessageResponse } from '@odovox/types';
import { cn } from '@/lib/utils';

function Bubble({ m }: { m: MessageResponse }) {
  const outbound = m.direction === 'OUTBOUND';
  const tone = messageStatusTone(m.status);
  const time = new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  return (
    <div className={cn('flex', outbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-elev-1',
          // §12.1: outbound = sage-soft, inbound = paper-warm; never lime for message content.
          outbound ? 'rounded-br-sm bg-sage-soft text-ink' : 'rounded-bl-sm bg-paper-warm text-ink',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{m.body}</p>
        <p className="mt-1 flex items-center gap-1 text-[11px]">
          <span className="text-text-subtle">{time}</span>
          {outbound ? (
            <span
              className={cn(
                'ml-1 font-medium',
                tone === 'read' ? 'text-sage-deep' : tone === 'failed' ? 'text-danger' : 'text-text-subtle',
              )}
            >
              {messageStatusLabel(m.status)}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const router = useRouter();
  const query = useConversation(conversationId);
  const reply = useReply(conversationId);
  const resolve = useResolveConversation(conversationId);
  const toast = useToast();
  const [text, setText] = useState('');

  const convo = query.data;
  const open = convo ? windowOpen(convo.windowExpiresAt) : false;

  async function send() {
    if (!text.trim()) return;
    try {
      await reply.mutateAsync(text.trim());
      setText('');
    } catch {
      toast.error('The 24-hour window may have closed — send a template instead.');
    }
  }

  return (
    <AnimatedPage className="flex h-[100dvh] flex-col bg-paper">
      {/* Header (glass — allowed on detail header per §12.1) */}
      <GlassCard tone="light" border="none" className="shrink-0 rounded-none px-4 pb-3 pt-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.push('/messages')} aria-label="Back" className="rounded-full p-1">
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">{convo?.patientName ?? 'Conversation'}</h1>
            {convo ? (
              <p className="flex items-center gap-1 text-xs text-text-subtle">
                <Clock className="size-3" />
                {open ? `Window expires in ${windowCountdown(convo.windowExpiresAt)}` : 'Window closed — template only'}
              </p>
            ) : null}
          </div>
          {convo && convo.status !== 'RESOLVED' ? (
            <button
              type="button"
              onClick={() => resolve.mutate()}
              className="flex items-center gap-1 rounded-pill bg-paper-warm px-3 py-1.5 text-xs font-medium text-text-subtle"
            >
              <Check className="size-3.5" /> Resolve
            </button>
          ) : null}
        </div>
      </GlassCard>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {query.isLoading ? (
          <ListSkeleton />
        ) : (
          convo?.messages.map((m) => <Bubble key={m.id} m={m} />)
        )}
      </div>

      {/* Quick actions */}
      {convo?.category === 'RESCHEDULE_REQUEST' ? (
        <div className="shrink-0 px-4 pb-2">
          <button
            type="button"
            onClick={() => router.push('/schedule')}
            className="flex w-full items-center justify-center gap-2 rounded-pill bg-paper-warm py-2.5 text-sm font-medium text-ink"
          >
            <CalendarClock className="size-4" /> Reschedule appointment
          </button>
        </div>
      ) : null}

      {/* Composer */}
      <div className="shrink-0 border-t border-border bg-paper px-4 py-3" style={{ paddingBottom: 'calc(12px + var(--safe-bottom))' }}>
        {open ? (
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a reply…"
              rows={1}
              className="max-h-28 flex-1 resize-none rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-border-strong"
            />
            <button
              type="button"
              onClick={send}
              disabled={!text.trim() || reply.isPending}
              aria-label="Send reply"
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full',
                text.trim() && !reply.isPending ? 'bg-lime text-ink' : 'bg-border text-text-subtle',
              )}
            >
              <Send className="size-5" />
            </button>
          </div>
        ) : (
          <p className="rounded-2xl bg-paper-warm px-4 py-3 text-center text-xs text-text-subtle">
            The 24-hour reply window has closed. Send an approved template message from the patient’s detail.
          </p>
        )}
      </div>
    </AnimatedPage>
  );
}
