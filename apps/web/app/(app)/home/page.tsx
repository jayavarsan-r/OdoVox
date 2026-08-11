"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CalendarOff,
  ChevronRight,
  Clock,
  FlaskConical,
  Pill,
  Play,
  Plus,
  UserPlus,
} from "lucide-react";
import { AnimatedPage } from "@/components/animated-page";
import { ProfileButton } from "@/components/app-shell/profile-button";
import {
  DayRiver,
  EmptyState,
  FabMenu,
  IconCircle,
  OfflineBanner,
  ProgressRing,
  QuickTile,
  SectionHeader,
  StatPill,
} from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, Mini } from "@/components/ui/badge";
import { InitialsAvatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useNeedsYou, useRecentVisits } from "@/lib/queries";
import { useSchedule } from "@/lib/schedule/api";
import { formatLocalTime, localDateISO } from "@/lib/schedule/tz";
import { useQueueStore } from "@/lib/queue/store";
import { getInChair, getWaiting } from "@/lib/queue/selectors";
import { useQueueSnapshot } from "@/lib/queue/mutations";
import { heroClinicalLine } from "@/lib/queue/home-summary";
import { flowState } from "@/lib/queue/home-state";
import { useDailyCollection } from "@/lib/billing/api";
import { rupees } from "@/lib/queue/checkout-form";
import { MascotMoment } from "@/components/illustrations";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/** "Morning" before noon, "Afternoon" to 17:00, then "Evening" — the frame's greeting. */
function greeting(hour: number): string {
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

/**
 * `/home` — Flow, frame 13.
 *
 * The frame's spine, top to bottom: eyebrow date over a 24px greeting with the ＋ and the
 * avatar; the day river with its caption; the `.hero-c` for whoever is in the chair; a
 * three-tile quick bento; "Up next" over the queue; "Needs you" over the action rows.
 *
 * Ruled and closed: the voice search field (#29), the VoiceCommandHero (#30) and two
 * extra quick tiles (#31) are gone — patient search belongs to /patients, the dock orb is
 * the single global voice affordance, and both actions live on /more and the speed dial.
 * The "Recent" section stays (#32): it is the only place recent visits surface.
 *
 * Every data source is unchanged: the same queue snapshot that drives /consult, the same
 * schedule, needs-you and recent-visits queries, the same routes behind every tap.
 */
export default function DoctorHomePage() {
  const router = useRouter();
  const { user } = useAuth();
  // Frame 18 — "Home ＋ · speed dial open". The ＋ summons the dial.
  const [dialOpen, setDialOpen] = useState(false);
  const needsYou = useNeedsYou();
  const recent = useRecentVisits();
  const collection = useDailyCollection();

  const todayISO = localDateISO(new Date(), "Asia/Kolkata");
  const todaySchedule = useSchedule(todayISO, todayISO, "me");
  const tz = todaySchedule.data?.clinicHours.timezone ?? "Asia/Kolkata";
  const appointments = todaySchedule.data?.appointments ?? [];
  const upNext = appointments
    .filter((a) => a.status === "SCHEDULED" || a.status === "CHECKED_IN")
    .slice(0, 6);

  // Same source of truth as /consult: snapshot hydrates the store, realtime keeps it live.
  useQueueSnapshot("me");
  const queueState = useQueueStore((s) => s.state);
  const myDoctorId = useQueueStore((s) => s.myDoctorId) ?? undefined;
  const inChair = getInChair(queueState, myDoctorId);
  const waiting = getWaiting(queueState, myDoctorId);

  const now = new Date();
  const dateLabel = `${WEEKDAYS[now.getDay()]} · ${now.getDate()} ${MONTHS[now.getMonth()]}`;
  const raw =
    (user?.name || "Doctor").replace(/^Dr\.?\s*/i, "").split(" ")[0] ||
    "Doctor";
  const firstName = raw.charAt(0).toUpperCase() + raw.slice(1);

  const done = appointments.filter((a) => a.status === "COMPLETED").length;
  const total = appointments.length;
  const needsCount = needsYou.data?.items.length ?? 0;

  /**
   * Which Flow frame is true. One call, tested boundaries — the alternative is five
   * nested ternaries in JSX that nobody can prove correct at 9am on a Monday.
   */
  const state = flowState({
    total,
    done,
    inChair: !!inChair,
    waiting: waiting.length,
  });

  const nextAppt = upNext[0];
  const nextName = nextAppt?.patientName ?? null;
  const nextTime = nextAppt
    ? formatLocalTime(new Date(nextAppt.startsAt), tz)
    : null;

  return (
    <AnimatedPage className="flex flex-1 flex-col pb-28">
      {/* Header — eyebrow over a 24px greeting, with the ＋ and the avatar. */}
      <header className="flex items-center justify-between gap-3 px-gutter pt-2">
        <div className="min-w-0">
          <p className="text-eyebrow font-heavy uppercase tracking-eyebrow text-pine-3">
            {dateLabel}
          </p>
          <h1 className="mt-[3px] truncate text-[24px] font-heavy leading-[1.1] tracking-tight text-pine">
            {greeting(now.getHours())}, Dr. {firstName}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-[7px]">
          <IconCircle
            size="md"
            tone="lime"
            aria-label="New"
            aria-expanded={dialOpen}
            onClick={() => setDialOpen((v) => !v)}
          >
            <Plus />
          </IconCircle>
          <ProfileButton />
        </div>
      </header>

      {/* Frame 17. ADDITIVE — it sits above the hero and does not replace it, because
          recording, notes and checkout all keep working offline. */}
      <OfflineBanner className="mx-gutter mt-3" />

      {/* The day river — every appointment today as one segment, the chair as the marker. */}
      <DayRiver
        className="mt-3.5 px-gutter"
        total={appointments.length}
        done={done}
        currentIndex={inChair ? done : null}
        onSelect={() => router.push("/schedule")}
        caption={
          <>
            {done} seen
            {inChair ? (
              <>
                {" · "}
                <b className="font-heavy text-pine">
                  {inChair.patient.name.split(" ")[0]} in the chair
                </b>
              </>
            ) : null}
            {" · "}
            {waiting.length} to go
          </>
        }
      />

      {/* `.hero-c` — one card, five faces. Which one is true is decided by
          `flowState`, not by conditions scattered through this JSX. Frames 13-16. */}
      <div className="mt-3 px-gutter">
        <Card wash className="p-[15px]">
          {state === "in-chair" && inChair ? (
            <>
              <Chip tone="live" className="mb-2.5">
                IN CHAIR
              </Chip>
              <div className="flex items-center gap-[13px]">
                {/* Frame 13's ring is the SITTING count (2/3), not the day's progress —
                    it answers "where are we in this treatment", which is what a doctor
                    picking up mid-plan needs. Falls back to the day when there is no
                    plan, because most visits are one-off. */}
                <ProgressRing
                  value={inChair.activePlan?.sitting ?? done}
                  max={Math.max(
                    inChair.activePlan?.totalSittings ?? total,
                    1,
                  )}
                  size={56}
                  tone="lime"
                  caption={inChair.activePlan ? "SITTING" : "TODAY"}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[19px] font-heavy tracking-tight text-pine">
                    {inChair.patient.name}
                  </p>
                  {/* "RCT 36 · obturation today · penicillin allergy" — procedure, tooth,
                      and the allergy in crit. The allergy is NEVER truncated away: it is
                      rendered as its own span so it survives the line clamping. */}
                  <p className="mt-[3px] text-[11.5px] font-semibold text-pine-2">
                    <span className="truncate">
                      {heroClinicalLine(inChair)}
                    </span>
                    {inChair.patient.medicalFlags.length > 0 ? (
                      <span className="font-heavy text-crit">
                        {" · "}
                        {inChair.patient.medicalFlags.join(" · ")}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
              <Button
                block
                className="mt-3 h-[46px] text-[14.5px]"
                onClick={() => router.push("/consult")}
              >
                <Play />
                Continue consultation
              </Button>
            </>
          ) : null}

          {/* Frame 14 — chair free, people waiting. The ring turns sky: the day is
              progressing but nothing is happening right now. */}
          {state === "chair-free" ? (
            <>
              <Chip tone="sky" className="mb-2.5">
                CHAIR FREE
              </Chip>
              <div className="flex items-center gap-[13px]">
                <ProgressRing
                  value={done}
                  max={Math.max(total, 1)}
                  size={56}
                  tone="sky"
                  caption="TODAY"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[22px] font-heavy tracking-tight text-pine">
                    {nextName ?? "Next patient"}
                  </p>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {nextTime ? (
                      <Mini tone="neutral">Next · {nextTime}</Mini>
                    ) : null}
                    <Mini tone="lav">{waiting.length} waiting</Mini>
                  </span>
                </div>
              </div>
              <Button
                block
                className="mt-3 h-[46px] text-[14.5px]"
                onClick={() => router.push("/consult")}
              >
                Call next patient
              </Button>
            </>
          ) : null}

          {/* Frame 15 — quiet. Nothing to do yet, so the card says when that changes
              rather than offering an action there is no reason to take. */}
          {state === "quiet" ? (
            <>
              <p className="text-[22px] font-heavy tracking-tight text-pine">
                {nextTime ? `Quiet until ${nextTime}` : "Quiet for now"}
              </p>
              <p className="mt-[3px] text-[11.5px] font-semibold text-pine-2">
                {total} booked today
                {nextName ? ` · first is ${nextName}` : ""}
              </p>
              <Button
                block
                className="mt-3 h-[46px] text-[14.5px]"
                onClick={() => router.push("/schedule")}
              >
                See the day
              </Button>
            </>
          ) : null}

          {/* Frame 16 — day done. Odo celebrates, and the stats are the proof. */}
          {state === "day-done" ? (
            <>
              <div className="flex items-center gap-[13px]">
                <MascotMoment
                  pose="celebrate"
                  size="md"
                  animation="bounce-in"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[22px] font-heavy tracking-tight text-pine">
                    That&apos;s all {total}
                  </p>
                  <p className="mt-[3px] text-[11.5px] font-semibold text-pine-2">
                    Every record confirmed · nothing pending
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-gap-tight">
                <StatPill label="SEEN" value={String(done)} />
                {collection.data ? (
                  <StatPill
                    label="TODAY"
                    value={rupees(collection.data.totalCollectedPaise)}
                  />
                ) : null}
              </div>
            </>
          ) : null}

          {/* Nothing booked and nobody waiting. Frame 13 has no drawing for this, so it
              wears the same anatomy and says the true thing. */}
          {state === "empty-day" ? (
            <>
              <p className="text-[22px] font-heavy tracking-tight text-pine">
                Nothing booked today
              </p>
              <p className="mt-[3px] text-[11.5px] font-semibold text-pine-2">
                Walk-ins and arrivals land here
              </p>
              <Button
                block
                className="mt-3 h-[46px] text-[14.5px]"
                onClick={() => router.push("/consult")}
              >
                Open the queue
              </Button>
            </>
          ) : null}
        </Card>
      </div>

      {/* The quick bento — exactly frame 13's three: Lab, Schedule, and the wide
          Block-time bar. New patient and Inventory were dropped (#31); both remain
          reachable from /more and the speed dial. */}
      <div className="mt-3 grid grid-cols-2 gap-gap-tight px-gutter">
        <QuickTile
          icon={<FlaskConical />}
          iconTone="warn"
          label="Lab"
          subtitle="Cases in flight"
          onClick={() => router.push("/lab")}
        />
        <QuickTile
          icon={<Calendar />}
          iconTone="lav"
          label="Schedule"
          subtitle="Today and ahead"
          onClick={() => router.push("/schedule")}
        />
        <QuickTile
          className="col-span-2"
          icon={<CalendarOff />}
          iconTone="warn"
          label="Block time · Day off"
          trailing={<ChevronRight className="size-[15px] text-pine-3" />}
          onClick={() => router.push("/clinic/day-off")}
        />
      </div>

      {/* Up next — the queue, as the frame's horizontal card rail. */}
      <SectionHeader
        title="Up next"
        action={`Queue · ${upNext.length}`}
        onAction={() => router.push("/schedule")}
      />
      {todaySchedule.isLoading ? (
        <Skeleton className="mx-gutter h-[86px] rounded-2xl" />
      ) : upNext.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<Calendar />}
          iconTone="sky"
          title="Nothing booked today."
          body="Tap Schedule to book one — or hold the orb and say it."
        />
      ) : (
        <div className="flex gap-gap-tight overflow-x-auto px-gutter pb-1">
          {upNext.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => router.push(`/schedule?date=${todayISO}`)}
              className="flex min-w-[130px] shrink-0 flex-col gap-1.5 rounded-2xl bg-card p-[11px] text-left shadow-tile"
            >
              <InitialsAvatar name={a.patientName} ring="sky" size="sm" />
              <span className="truncate text-[13px] font-heavy text-pine">
                {a.patientName}
              </span>
              <span className="flex flex-wrap gap-1">
                <Mini tone="neutral">
                  {formatLocalTime(new Date(a.startsAt), tz)}
                </Mini>
                {a.procedureHint ? (
                  <Mini tone="lav">{a.procedureHint}</Mini>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Needs you — the frame's action rows, each with its state dot. */}
      <SectionHeader
        title="Needs you"
        action={`View all · ${needsCount}`}
        actionTone={needsCount > 0 ? "crit" : "muted"}
        onAction={() => router.push("/messages")}
      />
      {needsYou.isLoading ? (
        <Skeleton className="mx-gutter h-16 rounded-2xl" />
      ) : needsCount === 0 ? (
        <EmptyState
          variant="inline"
          icon={<Clock />}
          iconTone="neutral"
          title="All caught up."
          body="Nothing is waiting on you right now."
        />
      ) : (
        <Card className="mx-gutter overflow-hidden py-0.5">
          {needsYou.data!.items.map((item, i) => {
            const href =
              item.href ??
              (item.patientId ? `/patients/${item.patientId}` : null);
            const urgent =
              item.kind === "LOW_STOCK" || item.kind === "LAB_OVERDUE";
            return (
              <button
                key={i}
                type="button"
                onClick={() => href && router.push(href)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <span className="min-w-0 flex-1 text-[14px] font-semibold text-pine">
                  {item.title}
                </span>
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-pill",
                    urgent ? "bg-crit" : "bg-lime",
                  )}
                />
              </button>
            );
          })}
        </Card>
      )}

      {/* ── Recent — kept from the previous Home by ruling ────────────────────
          Frame 13 has no Recent section, but #32 was ruled KEEP: this is the only
          place recent visits surface outside a patient record. The other three
          holdovers on this screen (#29, #30, #31) were ruled DROP and are gone. */}
      <SectionHeader
        title="Recent"
        action="See all"
        onAction={() => router.push("/patients")}
      />
      {recent.isLoading ? (
        <Skeleton className="mx-gutter h-16 rounded-2xl" />
      ) : (recent.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          variant="inline"
          icon={<Clock />}
          iconTone="neutral"
          title="No visits yet"
          body="Recorded visits show up here."
        />
      ) : (
        <Card className="mx-gutter overflow-hidden py-0.5">
          {recent.data!.items.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => router.push(`/patients/${v.patientId}`)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-pine">
                  {v.patientName}
                </span>
                <span className="block truncate text-[11.5px] font-semibold text-pine-2">
                  {new Date(v.date).toLocaleDateString("en-IN")} ·{" "}
                  {v.procedureSummary}
                </span>
              </span>
              <ChevronRight className="size-[15px] shrink-0 text-pine-3" />
            </button>
          ))}
        </Card>
      )}

      {/* Frame 18. Controlled by the header ＋, so no second floating button competes
          with the dock's orb — and nothing overlaps "Needs you" any more. */}
      <FabMenu
        open={dialOpen}
        onOpenChange={setDialOpen}
        items={[
          {
            id: "new-patient",
            label: "New patient",
            tone: "peach",
            icon: <UserPlus />,
            onClick: () => router.push("/patients/new"),
          },
          {
            id: "new-appointment",
            label: "New appointment",
            tone: "sky",
            icon: <Calendar />,
            onClick: () => router.push("/schedule?dictate=1"),
          },
          {
            id: "quick-rx",
            label: "Quick prescription",
            tone: "sage",
            icon: <Pill />,
            onClick: () => router.push("/patients"),
          },
        ]}
      />
    </AnimatedPage>
  );
}
