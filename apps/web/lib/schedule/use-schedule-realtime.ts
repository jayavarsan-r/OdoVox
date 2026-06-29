'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { realtime } from '../realtime/socket';

const SCHEDULE_EVENTS = new Set([
  'schedule.appointment.created',
  'schedule.appointment.rescheduled',
  'schedule.appointment.cancelled',
  'schedule.appointment.no_show',
]);

/**
 * Keep the calendar live: when any schedule.appointment.* broadcast lands, invalidate the schedule
 * queries so react-query refetches the affected day. The socket itself is connected once in the
 * app shell (useRealtime); we just add a listener here.
 */
export function useScheduleRealtime(): void {
  const qc = useQueryClient();
  useEffect(() => {
    const off = realtime.onEvent((event) => {
      if (SCHEDULE_EVENTS.has(event.type)) {
        void qc.invalidateQueries({ queryKey: ['schedule'] });
        void qc.invalidateQueries({ queryKey: ['schedule-slots'] });
      }
    });
    return off;
  }, [qc]);
}
