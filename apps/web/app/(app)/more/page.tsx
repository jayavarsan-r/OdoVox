'use client';

import { useRouter } from 'next/navigation';
import {
  Building2,
  CalendarClock,
  CalendarOff,
  ChevronRight,
  FlaskConical,
  IndianRupee,
  MessageCircle,
  Package,
  Pill,
  User,
  Users,
} from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import {
  BentoTile,
  EditorialHeading,
  IconCircle,
  SectionHeader,
  SettingRow,
  StatusDot,
} from '@/components/ds';
import { Card } from '@/components/ui/card';
import { Chip, Mini } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { canAccess, type Role } from '@/lib/rbac';
import { useLabCases } from '@/lib/lab-queries';
import { useInventoryItems } from '@/lib/inventory-queries';
import { useConversations } from '@/lib/whatsapp-queries';
import { useWhatsAppSettings } from '@/lib/whatsapp-queries';
import { useDailyCollection } from '@/lib/billing/api';
import { useDayOffs } from '@/lib/schedule/api';
import { useClinicRoster } from '@/lib/queries';
import { useTemplates } from '@/lib/queries';
import { rupees } from '@/lib/queue/checkout-form';
import { cn } from '@/lib/utils';

/**
 * `/more` — the module hub (v9 frame 70).
 *
 * The v9 nav is four tabs plus the orb, so Lab, Messages, Inventory and Billing moved
 * here. None of them were removed: every route keeps its path and stays directly
 * linkable. This screen is what makes that restructure honest — the spec's note is
 * that "attention states surface here so More is never a dead end", which is why each
 * tile carries a live count and a marker rather than being a static launcher.
 *
 * Counts come only from hooks that already exist. Where there is no existing source,
 * the count line is omitted rather than a query invented for it.
 */
function ModuleTile({
  icon,
  iconTone,
  name,
  count,
  marker,
  onClick,
}: {
  icon: React.ReactNode;
  iconTone: 'lav' | 'sky' | 'warn' | 'lime';
  name: string;
  count?: string;
  marker?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl text-left transition-transform duration-press active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]"
    >
      <BentoTile>
        <span className="flex items-start justify-between">
          <IconCircle asSpan tone={iconTone} size="md" shape="square">
            {icon}
          </IconCircle>
          {marker}
        </span>
        <span className="mt-2.5 block text-md font-heavy text-pine">{name}</span>
        {count ? <span className="block text-2xs font-semibold text-pine-3">{count}</span> : null}
      </BentoTile>
    </button>
  );
}

export default function MorePage() {
  const router = useRouter();
  const { user, clinic, activeMembership } = useAuth();
  const role = (activeMembership?.role ?? 'DOCTOR') as Role;
  const go = (href: string) => () => router.push(href);

  // Both are infinite queries: counts come from the pages already fetched, which is
  // the first page. That is enough for a hub badge and costs no extra request.
  const labCases = useLabCases({});
  const inventory = useInventoryItems({});
  const conversations = useConversations({ status: 'OPEN' });
  const collection = useDailyCollection();
  const whatsapp = useWhatsAppSettings();
  // Frame 70 puts a value on every setup row — the hub's whole point is that it shows
  // state, not just destinations. Two of the four have a source today.
  const dayOffs = useDayOffs();
  const roster = useClinicRoster();
  const templates = useTemplates('');

  const today = new Date().setHours(0, 0, 0, 0);
  const upcomingDayOffs =
    dayOffs.data?.dayOffs.filter((d) => new Date(d.endDate ?? d.date).setHours(0, 0, 0, 0) >= today)
      .length ?? 0;
  const templateCount = templates.data?.items.length ?? 0;
  // `?? 0` deliberately, so a loading or failed roster renders NO chip rather than "0
  // doctors" — a clinic always has at least one, so zero would only ever be a lie about
  // the query, never a fact about the clinic.
  const doctorCount = roster.data?.counts.doctors ?? 0;
  const pendingCount = roster.data?.counts.pending ?? 0;

  const cases = labCases.data?.pages.flatMap((p) => p.items) ?? [];
  const overdueLab = cases.filter((c) => c.status === 'ISSUE_RAISED').length;
  const items = inventory.data?.pages.flatMap((p) => p.items) ?? [];
  const lowStock = items.filter((i) => i.isLowStock).length;
  const openThreads = conversations.data?.length ?? 0;

  const loading = labCases.isLoading || inventory.isLoading || conversations.isLoading;

  return (
    <AnimatedPage className="flex flex-1 flex-col pb-28">
      <div className="px-gutter pt-4">
        <EditorialHeading
          title="More"
          trailing={
            <Chip tone="neutral">
              <Building2 className="size-[13px]" />
              {clinic?.name ?? 'Your clinic'}
            </Chip>
          }
        />
      </div>

      {/* Modules, with live counts — frame 70's top half */}
      <div className="mt-3.5 grid grid-cols-2 gap-gap-tight px-gutter">
        {loading ? (
          <>
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </>
        ) : (
          <>
            <ModuleTile
              icon={<FlaskConical />}
              iconTone="lav"
              name="Lab"
              count={cases.length ? `${cases.length} active` : undefined}
              marker={overdueLab > 0 ? <Mini tone="crit">{overdueLab} late</Mini> : undefined}
              onClick={go('/lab')}
            />
            <ModuleTile
              icon={<MessageCircle />}
              iconTone="sky"
              name="Messages"
              count={openThreads ? `${openThreads} open` : undefined}
              marker={
                openThreads > 0 ? (
                  <StatusDot tone="lime" label={`${openThreads} open`} />
                ) : undefined
              }
              onClick={go('/messages')}
            />
            <ModuleTile
              icon={<Package />}
              iconTone="warn"
              name="Inventory"
              count={items.length ? `${items.length} items` : undefined}
              marker={lowStock > 0 ? <Mini tone="warn">{lowStock} low</Mini> : undefined}
              onClick={go('/inventory')}
            />
            {canAccess('/billing', role) ? (
              <ModuleTile
                icon={<IndianRupee />}
                iconTone="lime"
                name="Billing"
                count={
                  collection.data
                    ? `${rupees(collection.data.totalCollectedPaise)} today`
                    : undefined
                }
                onClick={go('/billing')}
              />
            ) : null}
          </>
        )}
      </div>

      {/* Clinic setup — frame 70's bottom half */}
      <SectionHeader title="Clinic setup" />
      <Card className="mx-gutter overflow-hidden py-0.5">
        <SettingRow
          icon={<MessageCircle />}
          tone="live"
          title="WhatsApp"
          value={
            whatsapp.data
              ? `${rupees(whatsapp.data.spentThisMonthPaise)}${whatsapp.data.budgetPaise ? ` / ${rupees(whatsapp.data.budgetPaise)}` : ''}`
              : undefined
          }
          trailing={<ChevronRight className="size-[15px] shrink-0 text-pine-3" />}
          onClick={go('/clinic/whatsapp')}
        />
        {/*
          Frame 70's "2 doctors" and "1 request". Both read GET /clinics/members, which the
          hub now has; before it existed the values were omitted rather than faked, because
          a number no query stands behind is worse than no number.

          Still omitted while the query is loading or failed — a chip that flickers "0
          doctors" and then corrects itself has told the reader something false.
        */}
        <SettingRow
          icon={<CalendarClock />}
          tone="sky"
          title="Availability"
          value={doctorCount ? `${doctorCount} doctor${doctorCount > 1 ? 's' : ''}` : undefined}
          trailing={<ChevronRight className="size-[15px] shrink-0 text-pine-3" />}
          onClick={go('/clinic/availability')}
        />
        <SettingRow
          icon={<CalendarOff />}
          tone="crit"
          title="Days off"
          value={upcomingDayOffs ? `${upcomingDayOffs} upcoming` : undefined}
          trailing={<ChevronRight className="size-[15px] shrink-0 text-pine-3" />}
          onClick={go('/clinic/day-off')}
        />
        <SettingRow
          icon={<Pill />}
          tone="lav"
          title="Rx templates"
          value={templateCount ? String(templateCount) : undefined}
          trailing={<ChevronRight className="size-[15px] shrink-0 text-pine-3" />}
          onClick={go('/clinic/templates')}
        />
        {canAccess('/clinic', role) ? (
          <SettingRow
            icon={<Users />}
            title="Team & join code"
            value={
              // A PILL, not the grey value text every other row uses. Frame 70 draws this
              // one differently on purpose: "2 upcoming" and "12" are things to know,
              // whereas a pending request is a person waiting on someone here to act.
              // The tone carries that distinction; grey text flattens it away.
              pendingCount ? (
                <Mini tone="sky">
                  {pendingCount} request{pendingCount > 1 ? 's' : ''}
                </Mini>
              ) : undefined
            }
            trailing={<ChevronRight className="size-[15px] shrink-0 text-pine-3" />}
            onClick={go('/clinic')}
          />
        ) : null}
        <SettingRow
          icon={<User />}
          title="Account"
          value={user?.name ?? undefined}
          trailing={<ChevronRight className="size-[15px] shrink-0 text-pine-3" />}
          onClick={go('/clinic')}
        />
      </Card>

      <p className={cn('px-gutter-wide pt-3 text-2xs font-medium text-pine-3')}>
        Every module keeps its own route — nothing moved out of reach.
      </p>
    </AnimatedPage>
  );
}
