"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  Plus,
  Search,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { AnimatedPage } from "@/components/animated-page";
import { ProfileButton } from "@/components/app-shell/profile-button";
import { VoiceSearchInput } from "@/components/voice-search-input";
import {
  EmptyState,
  FabMenu,
  IconCircle,
  StatusDot,
} from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, Mini } from "@/components/ui/badge";
import { InitialsAvatar } from "@/components/ui/avatar";
import { ListSkeleton } from "@/components/ui/skeleton";
import { usePatients } from "@/lib/queries";
import { rupees } from "@/lib/patient-ui";
import type {
  PatientFilter,
  PatientListItem,
  PatientStatus,
} from "@odovox/types";

/**
 * Frame 32's filter row. The frame shows All / Today / Treating / ₹ Due; the first three
 * map onto filters the API already has, so they take the frame's shorter labels.
 *
 * "₹ Due" has NO server counterpart — there is no outstanding-balance filter — so it is
 * not rendered. Adding a chip that silently returns the unfiltered list would be worse
 * than its absence. Recorded as NOT-BUILT #38.
 *
 * `lab_pending` and `recent` have no chip in the frame but are existing functionality and
 * are kept (deviation #39).
 */
const FILTERS: { value: PatientFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "due_today", label: "Today" },
  { value: "in_chair", label: "Treating" },
  { value: "lab_pending", label: "Lab" },
  { value: "recent", label: "Recent" },
];

/** The frame rings the avatar by state: live in the chair, sky for lab, bare otherwise. */
function ringFor(status: PatientStatus): "live" | "sky" | "none" {
  if (status === "IN_CHAIR") return "live";
  if (status === "LAB_PENDING") return "sky";
  return "none";
}

/**
 * Frame 33 highlights the matched substring on a lime-soft chip rather than bolding the
 * whole name — so a doctor scanning ten "Laksh…" rows can see WHY each one matched.
 */
function Highlighted({ text, match }: { text: string; match: string }) {
  const q = match.trim();
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <b className="rounded-[4px] bg-lime-soft px-0.5 font-heavy">
        {text.slice(at, at + q.length)}
      </b>
      {text.slice(at + q.length)}
    </>
  );
}

/** Frame 32's `.vrow`: 44px ringed avatar, name, glyph Minis, a state dot on the right. */
function PatientRow({
  p,
  match,
  onClick,
}: {
  p: PatientListItem;
  match: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
    >
      <InitialsAvatar name={p.name} ring={ringFor(p.status)} size="md" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-heavy text-pine">
          <Highlighted text={p.name} match={match} />
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <Mini tone="neutral">{p.age}</Mini>
          {p.chiefComplaint ? <Mini tone="lav">{p.chiefComplaint}</Mini> : null}
          {p.medicalFlags.length > 0 ? (
            <Mini tone="crit">{p.medicalFlags[0]}</Mini>
          ) : null}
          {p.outstandingPaise > 0 ? (
            <Mini tone="crit">{rupees(p.outstandingPaise)}</Mini>
          ) : null}
        </span>
      </span>
      {p.status === "IN_CHAIR" ? (
        <StatusDot tone="live" />
      ) : p.status === "LAB_PENDING" ? (
        <StatusDot tone="sky" />
      ) : null}
    </button>
  );
}

function PatientsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  // Frames 33/34 replace the whole header with the field and a Cancel — search is a MODE,
  // not a bar that always sits there taking a fifth of the screen.
  const [searching, setSearching] = useState(!!params.get("search"));
  const [filter, setFilter] = useState<PatientFilter>("all");
  // Frame 32 puts ＋ in the header, not floating over the list. Same as Flow.
  const [dialOpen, setDialOpen] = useState(false);
  const query = usePatients(search, filter);

  const all = query.data?.pages.flatMap((p) => p.items) ?? [];
  const trimmed = search.trim();

  const cancelSearch = () => {
    setSearch("");
    setSearching(false);
  };

  return (
    <AnimatedPage className="flex flex-1 flex-col pb-28">
      {searching ? (
        /* Frames 33 and 34 — the search mode. */
        <div className="flex items-center gap-2 px-gutter pt-2">
          <div className="min-w-0 flex-1">
            <VoiceSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Name, phone, or patient ID"
              autoFocus
            />
          </div>
          <button
            type="button"
            onClick={cancelSearch}
            className="shrink-0 text-[13.5px] font-heavy text-pine-2"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          {/* Frame 32 — a 28px title with the search and ＋ circles. */}
          <header className="flex items-center justify-between gap-3 px-gutter pt-2">
            <h1 className="truncate text-[28px] font-heavy tracking-tight text-pine">
              Patients
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              <IconCircle
                size="md"
                aria-label="Search patients"
                onClick={() => setSearching(true)}
              >
                <Search />
              </IconCircle>
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

          <div className="mt-3.5 flex gap-2 overflow-x-auto px-gutter pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className="shrink-0"
              >
                <Chip tone={filter === f.value ? "pine" : "neutral"}>
                  {f.label}
                </Chip>
              </button>
            ))}
          </div>
        </>
      )}

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <EmptyState
          variant="inline"
          icon={<TriangleAlert />}
          iconTone="peach"
          title="Couldn't load patients"
          body="Pull to retry."
        />
      ) : all.length === 0 && trimmed ? (
        /* Frame 34 — no match. The frame does not stop at "nothing found": it offers to
           create the person you just typed, because that is what you were going to do. */
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-gutter">
          <p className="text-center text-[17px] font-heavy text-pine">
            No one named &ldquo;{trimmed}&rdquo;
          </p>
          <p className="text-center text-[12.5px] font-bold text-pine-2">
            Check spelling — or try their phone number
          </p>
          <Button
            className="mt-1.5 h-12 w-[280px]"
            onClick={() =>
              router.push(`/patients/new?name=${encodeURIComponent(trimmed)}`)
            }
          >
            <Plus /> Add &ldquo;{trimmed}&rdquo; as new patient
          </Button>
        </div>
      ) : all.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<UserPlus />}
          iconTone="sky"
          title="No patients yet"
          body="Add your first patient with the ＋ above."
        />
      ) : (
        <>
          <Card className="mx-gutter divide-y divide-hair overflow-hidden py-0.5">
            {all.map((p) => (
              <PatientRow
                key={p.id}
                p={p}
                match={trimmed}
                onClick={() => router.push(`/patients/${p.id}`)}
              />
            ))}
          </Card>
          {query.hasNextPage ? (
            <button
              type="button"
              onClick={() => query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              className="mx-auto mt-3 rounded-pill px-4 py-2 text-[13px] font-heavy text-pine-2"
            >
              {query.isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          ) : null}
        </>
      )}

      {searching ? null : (
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
          ]}
        />
      )}
    </AnimatedPage>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <PatientsInner />
    </Suspense>
  );
}
