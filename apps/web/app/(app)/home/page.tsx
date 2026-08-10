"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
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
import { VoiceCommandHero } from "@/components/voice/voice-command-hero";
import { VoiceSearchInput } from "@/components/voice-search-input";
import {
  DayRiver,
  EmptyState,
  FabMenu,
  IconCircle,
  ProgressRing,
  QuickTile,
  SectionHeader,
} from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mini } from "@/components/ui/badge";
import { InitialsAvatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useNeedsYou, useRecentVisits } from "@/lib/queries";
import { useSchedule } from "@/lib/schedule/api";
import { formatLocalTime, localDateISO } from "@/lib/schedule/tz";
import { useQueueStore } from "@/lib/queue/store";
import { getInChair, getWaiting } from "@/lib/queue/selectors";
import { useQueueSnapshot } from "@/lib/queue/mutations";
import { consultHeroSubtitle } from "@/lib/queue/home-summary";
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
 * FOUR THINGS THIS PAGE HAS THAT FRAME 13 DOES NOT. None is deleted — the rule is that
 * functionality is not removed for pixel fidelity — so each is kept, restyled into the v9
 * language, and recorded as a pending deviation for a ruling:
 *
 *   #29 the voice search field        #31 five quick tiles where the frame has three
 *   #30 the voice command hero        #32 the "Recent" section
 *
 * Every data source is unchanged: the same queue snapshot that drives /consult, the same
 * schedule, needs-you and recent-visits queries, the same routes behind every tap.
 */
export default function DoctorHomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const needsYou = useNeedsYou();
  const recent = useRecentVisits();

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
  const needsCount = needsYou.data?.items.length ?? 0;

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
            onClick={() => router.push("/patients/new")}
          >
            <Plus />
          </IconCircle>
          <ProfileButton />
        </div>
      </header>

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

      {/* `.hero-c` — whoever is in the chair, and the one action that matters. */}
      <div className="mt-3 px-gutter">
        {inChair ? (
          <Card wash className="p-[15px]">
            <div className="flex items-center gap-[13px]">
              <ProgressRing value={1} max={1} size={56} tone="lime" label="•" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[19px] font-heavy tracking-tight text-pine">
                  {inChair.patient.name}
                </p>
                <p className="mt-[3px] truncate text-[11.5px] font-semibold text-pine-2">
                  {consultHeroSubtitle(inChair.patient.name, waiting.length)}
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
          </Card>
        ) : (
          <Card wash className="p-[15px]">
            <p className="text-[19px] font-heavy tracking-tight text-pine">
              {waiting.length > 0 ? "Chair is free" : "Nothing in the queue"}
            </p>
            <p className="mt-[3px] text-[11.5px] font-semibold text-pine-2">
              {consultHeroSubtitle(null, waiting.length)}
            </p>
            <Button
              block
              className="mt-3 h-[46px] text-[14.5px]"
              onClick={() => router.push("/consult")}
            >
              {waiting.length > 0 ? "Call next patient" : "Open the queue"}
            </Button>
          </Card>
        )}
      </div>

      {/* The quick bento. Frame 13 carries Lab, Schedule and a wide Block-time bar; the
          other three are kept (deviation #31) rather than dropped. */}
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
          icon={<UserPlus />}
          iconTone="live"
          label="New patient"
          subtitle="Add a record"
          onClick={() => router.push("/patients/new")}
        />
        <QuickTile
          icon={<Boxes />}
          iconTone="sky"
          label="Inventory"
          subtitle="Stock and supplies"
          onClick={() => router.push("/inventory")}
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

      {/* ── Kept from the previous Home, pending a ruling ─────────────────────
          Frame 13 has none of these. They are existing functionality, so they stay
          until you rule on them, restyled into the v9 language rather than left in
          the old one. Deviations #29, #30, #32. */}
      <SectionHeader title="Find and dictate" action="Not in frame 13" />
      <div className="space-y-3 px-gutter">
        <VoiceSearchInput
          value={search}
          onChange={setSearch}
          onSubmit={(v) =>
            router.push(
              `/patients${v ? `?search=${encodeURIComponent(v)}` : ""}`,
            )
          }
        />
        <VoiceCommandHero />
      </div>

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

      <FabMenu
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
