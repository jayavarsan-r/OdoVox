'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, Trash2, FileText } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { EditorialHeading, EmptyState } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Mini } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useArchiveTemplate,
} from '@/lib/queries';
import type { TemplateResponse, TemplateMedicine } from '@odovox/types';

interface DraftMedicine {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: string;
}

const EMPTY_MED: DraftMedicine = { name: '', dosage: '', frequency: '', durationDays: '' };

function toDraft(t: TemplateResponse): {
  id: string;
  name: string;
  description: string;
  tags: string;
  meds: DraftMedicine[];
} {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? '',
    tags: t.tags.join(', '),
    meds: t.medicines.map((m) => ({
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      durationDays: m.durationDays != null ? String(m.durationDays) : '',
    })),
  };
}

export default function TemplatesPage() {
  const router = useRouter();
  const toast = useToast();
  const role = useAuth((s) => s.activeMembership?.role ?? null);
  const userId = useAuth((s) => s.user?.id ?? null);
  const canManage = role === 'DOCTOR' || role === 'ADMIN';

  const [search, setSearch] = useState('');
  const { data, isLoading } = useTemplates(search);
  const templates = data?.items ?? [];

  const createMut = useCreateTemplate();
  const archiveMut = useArchiveTemplate();

  // Editor sheet state. `editing` holds the template id when editing, null when creating.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [meds, setMeds] = useState<DraftMedicine[]>([{ ...EMPTY_MED }]);
  const updateMut = useUpdateTemplate(editing ?? '');

  function openNew() {
    setEditing(null);
    setName('');
    setDescription('');
    setTags('');
    setMeds([{ ...EMPTY_MED }]);
    setSheetOpen(true);
  }

  function openEdit(t: TemplateResponse) {
    const d = toDraft(t);
    setEditing(d.id);
    setName(d.name);
    setDescription(d.description);
    setTags(d.tags);
    setMeds(d.meds.length ? d.meds : [{ ...EMPTY_MED }]);
    setSheetOpen(true);
  }

  const cleanMeds = useMemo(
    () =>
      meds
        .filter((m) => m.name.trim() && m.dosage.trim() && m.frequency.trim())
        .map<TemplateMedicine>((m) => ({
          name: m.name.trim(),
          dosage: m.dosage.trim(),
          frequency: m.frequency.trim(),
          durationDays: m.durationDays.trim() ? Number(m.durationDays) : null,
        })),
    [meds],
  );

  const canSave = name.trim().length > 0 && cleanMeds.length > 0;

  async function save() {
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      tags: tags
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
      medicines: cleanMeds,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync(payload);
        toast.success('Template updated');
      } else {
        await createMut.mutateAsync(payload);
        toast.success('Template created');
      }
      setSheetOpen(false);
    } catch {
      toast.error('Could not save the template');
    }
  }

  async function archive(t: TemplateResponse) {
    try {
      await archiveMut.mutateAsync(t.id);
      toast.success(`Archived “${t.name}”`);
    } catch {
      toast.error('Could not archive the template');
    }
  }

  function updateMed(i: number, patch: Partial<DraftMedicine>) {
    setMeds((rows) => rows.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  return (
    <AnimatedPage>
      <div className="flex flex-col gap-4 px-4 pb-28 pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Back"
            onClick={() => router.push('/clinic')}
            className="flex size-9 items-center justify-center rounded-pill hover:bg-muted"
          >
            <ChevronLeft className="size-5" />
          </button>
          <EditorialHeading
            className="flex-1"
            title="Rx templates"
            trailing={
              canManage ? (
                // The frame's lime + circle. A labelled "New" button competed with the
                // template names for the eye on a screen that is mostly a list to scan.
                <button
                  type="button"
                  aria-label="New template"
                  onClick={openNew}
                  className="flex size-9 items-center justify-center rounded-pill bg-lime text-pine shadow-cta"
                >
                  <Plus className="size-[18px]" />
                </button>
              ) : undefined
            }
          />
        </div>

        <Input
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {isLoading ? (
          <ListSkeleton />
        ) : templates.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-6" />}
            title="No templates yet"
            body={
              canManage
                ? 'Create your first prescription template to speed up common cases.'
                : 'Your clinic has no prescription templates yet.'
            }
          />
        ) : (
          /*
             Frame 75's list: one card, a row per template, scannable in a glance.

             It was a stack of hero cards carrying a description, two stat lines and a tag
             row each — four templates filled the screen. This is a PICKER before it is a
             manager: the question is "which bundle", and the answer is the name plus how
             many medicines are in it.

             Edit and archive have not gone anywhere; the row opens the editor that holds
             them, which is what the frame's chevron implies.
          */
          <div className="rounded-2xl bg-white shadow-elev-1">
            {templates.map((t) => {
              const mine = role === 'ADMIN' || t.createdById === userId;
              const openable = canManage && mine;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={!openable}
                  onClick={() => openEdit(t)}
                  className="flex w-full items-center gap-3 px-[15px] py-3 text-left disabled:cursor-default [&:not(:last-child)]:border-b [&:not(:last-child)]:border-hair"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-heavy text-pine">
                      {t.name}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Mini tone="neutral">
                        {t.medicines.length} med{t.medicines.length === 1 ? '' : 's'}
                      </Mini>
                      {t.tags.slice(0, 2).map((tag) => (
                        <Mini key={tag} tone="lav">
                          {tag}
                        </Mini>
                      ))}
                    </span>
                  </span>
                  {openable ? <ChevronRight className="size-[15px] shrink-0 text-pine-3" /> : null}
                </button>
              );
            })}
          </div>
        )}

        <p className="px-1 text-3xs font-bold leading-relaxed text-pine-3">
          Templates apply inside the prescription sheet and can be saved from any live Rx. Allergy
          checks still run on every apply.
        </p>
      </div>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? 'Edit template' : 'New template'}
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. RCT pack"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Description</span>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Tags</span>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="antibiotic, post-op (comma separated)"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Medicines</span>
            {meds.map((m, i) => (
              <div key={i} className="rounded-lg border border-border p-2.5">
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    value={m.name}
                    onChange={(e) => updateMed(i, { name: e.target.value })}
                    placeholder="Medicine name"
                  />
                  {meds.length > 1 ? (
                    <button
                      type="button"
                      aria-label="Remove medicine"
                      onClick={() => setMeds((rows) => rows.filter((_, idx) => idx !== i))}
                      className="flex size-9 shrink-0 items-center justify-center rounded-pill text-text-muted hover:bg-muted"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Input
                    value={m.dosage}
                    onChange={(e) => updateMed(i, { dosage: e.target.value })}
                    placeholder="500mg"
                  />
                  <Input
                    value={m.frequency}
                    onChange={(e) => updateMed(i, { frequency: e.target.value })}
                    placeholder="TID"
                  />
                  <Input
                    value={m.durationDays}
                    onChange={(e) =>
                      updateMed(i, { durationDays: e.target.value.replace(/[^0-9]/g, '') })
                    }
                    placeholder="days"
                    inputMode="numeric"
                  />
                </div>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMeds((rows) => [...rows, { ...EMPTY_MED }])}
            >
              <Plus className="size-4" /> Add medicine
            </Button>
          </div>

          <Button
            onClick={save}
            disabled={!canSave}
            loading={createMut.isPending || updateMut.isPending}
            className="mt-1"
          >
            {editing ? 'Save changes' : 'Create template'}
          </Button>

          {/*
            Archive lives here now that the list is a compact picker rather than a row of
            management icons. It is deliberately below Save and quiet: archiving is rare and
            destructive-feeling, and an icon sitting permanently beside every template name
            invited a mis-tap on the screen people use most often to just pick one.

            Only when editing — there is nothing to archive on a template that does not
            exist yet.
          */}
          {editing ? (
            <button
              type="button"
              onClick={() => {
                const row = templates.find((t) => t.id === editing);
                if (row) void archive(row);
              }}
              disabled={archiveMut.isPending}
              className="mt-1 self-center text-xs font-heavy text-pine-3 underline disabled:opacity-50"
            >
              Archive this template
            </button>
          ) : null}
        </div>
      </BottomSheet>
    </AnimatedPage>
  );
}
