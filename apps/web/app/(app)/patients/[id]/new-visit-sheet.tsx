'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useToast } from '@/lib/toast';
import { useCreateVisit } from '@/lib/queries';

export function NewVisitSheet({ patientId, open, onClose }: { patientId: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const createVisit = useCreateVisit(patientId);
  const [procedure, setProcedure] = useState('');
  const [notes, setNotes] = useState('');

  const save = async () => {
    try {
      await createVisit.mutateAsync({ procedure, notes: notes || undefined, toothNumbers: [] });
      toast.success('Visit recorded.');
      onClose();
      setProcedure(''); setNotes('');
    } catch (err) {
      toast.apiError(err);
    }
  };
  return (
    <BottomSheet open={open} onClose={onClose} title="Record a visit">
      <div className="space-y-3">
        <Input placeholder="Procedure (e.g. Scaling)" value={procedure} onChange={(e) => setProcedure(e.target.value)} />
        <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button className="w-full" disabled={!procedure.trim()} loading={createVisit.isPending} onClick={save}>Save visit</Button>
      </div>
    </BottomSheet>
  );
}

// ===== tiny shared bits ======================================================
