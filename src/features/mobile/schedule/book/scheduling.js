import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAppStore } from '../../../../store/useAppStore';
import { holidaysForUser } from '../../../holidays/holidayUtils';
import { noSlotsReason, openSlots } from '../../../calendar/openSlots';

// "2026-11-06" <-> "11-06-2026" (appointments store MM-DD-YYYY).
export const isoToAppt = (iso) => { const [y, m, d] = String(iso || '').split('-'); return y && m && d ? `${m}-${d}-${y}` : ''; };
export const apptToIso = (date) => { const [m, d, y] = String(date || '').split('-'); return y && m && d ? `${y}-${m}-${d}` : ''; };
export const isoOfDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * An appointment type's length in minutes. Types store it as text ("60 min",
 * "15-30 min"); a range books its longest length, none set books 30.
 */
export function typeDurationMin(type) {
  const nums = String(type?.duration || '').match(/\d+/g);
  const n = nums ? Number(nums[nums.length - 1]) : 0;
  return n > 0 ? n : 30;
}

/**
 * Active staff, as the desktop booking drawer lists them for Primary User
 * (useScheduleDrawer: profiles with status Active).
 */
export function useBookableUsers() {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    let live = true;
    supabase.from('profiles').select('id, full_name, first_name, last_name, email, status').order('full_name').then(({ data }) => {
      if (!live || !data) return;
      setUsers(data.filter(u => u.status === 'Active').map(u => ({
        id: u.id,
        name: u.full_name?.trim() || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
        email: u.email,
      })));
    });
    return () => { live = false; };
  }, []);
  return users;
}

/**
 * Everything openSlots needs for one provider, loaded the way the desktop
 * reschedule drawers load it. `slotsOn(iso, minutes, ignoreIds)` gives that
 * day's open start times; `whyNone(iso)` says why a day has none.
 */
export function useOpenSlots(provider) {
  const appointments = useAppStore(s => s.appointments);
  const segments = useAppStore(s => s.userAvailability);
  const fetchUserAvailability = useAppStore(s => s.fetchUserAvailability);
  const holidayConfigs = useAppStore(s => s.holidayConfigs);
  const fetchHolidayConfigs = useAppStore(s => s.fetchHolidayConfigs);
  const oooRecords = useAppStore(s => s.oooRecords);
  const fetchOooRecords = useAppStore(s => s.fetchOooRecords);
  const platformUsers = useAppStore(s => (s.platformPeople?.length ? s.platformPeople : s.platformUsers));
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => {
    fetchUserAvailability?.();
    fetchHolidayConfigs?.();
    fetchOooRecords?.();
    fetchPlatformUsers?.();
  }, [fetchUserAvailability, fetchHolidayConfigs, fetchOooRecords, fetchPlatformUsers]);

  const holidays = useMemo(() => (provider ? holidaysForUser(holidayConfigs, platformUsers, provider) : []), [holidayConfigs, platformUsers, provider]);
  const slotsOn = useCallback((date, durationMin, ignoreIds) => openSlots({
    date, person: provider, durationMin, segments, holidays, oooRecords, appointments, ignoreIds,
  }), [provider, segments, holidays, oooRecords, appointments]);
  const whyNone = useCallback((date) => (provider ? noSlotsReason({ date, person: provider, holidays, oooRecords }) : ''), [provider, holidays, oooRecords]);
  return { slotsOn, whyNone, segments, holidays };
}
