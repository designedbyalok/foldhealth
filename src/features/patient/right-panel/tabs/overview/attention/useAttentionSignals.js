import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../../../../store/useAppStore';
import { usePatientStream } from '../../../../hooks/usePatientStream';
import { groupTasksForTab } from '../../../../left-panel/tabs/tasks/TasksTab/groupTasksForTab';
import { tasksForPatient } from '../cards/patientTasks';
import { usePatientConversations } from '../cards/usePatientConversations';
import { useP360Profile } from '../cards/useP360Profile';
import { buildAttentionSignals } from './attentionSignals';

const EMPTY = [];
const NO_REVIEWS = {};

/**
 * The patient's attention signals (attentionSignals.js) from the data the
 * Overview already loads, split into open and reviewed by the team's
 * patient_signal_reviews.
 */
export function useAttentionSignals(patient, overview) {
  const memberId = patient?.memberId ? String(patient.memberId) : null;
  const { events, loading: streamLoading } = usePatientStream(patient?.id);
  const conversations = usePatientConversations(patient);
  const profile = useP360Profile(patient?.id);
  const allTasks = useAppStore(s => s.tasks);
  const fetchTasks = useAppStore(s => s.fetchTasks);
  const reviews = useAppStore(s => (memberId ? s.patientSignalReviews[memberId] : undefined)) || NO_REVIEWS;
  const fetchReviews = useAppStore(s => s.fetchPatientSignalReviews);

  useEffect(() => { fetchTasks?.(); }, [fetchTasks]);
  useEffect(() => { if (memberId) fetchReviews(memberId); }, [memberId, fetchReviews]);

  const overdue = useMemo(() => groupTasksForTab(tasksForPatient(allTasks, patient)).overdue, [allTasks, patient]);
  const built = useMemo(() => buildAttentionSignals({
    events,
    vitals: overview?.vitals,
    gaps: overview?.gaps,
    overdue,
    conversations: conversations || EMPTY,
    profile,
  }), [events, overview, overdue, conversations, profile]);

  return useMemo(() => ({
    ...built,
    events,
    memberId,
    reviews,
    open: built.signals.filter(s => !reviews[s.id]),
    reviewed: built.signals.filter(s => reviews[s.id]),
    loading: streamLoading || overview === undefined,
  }), [built, events, memberId, reviews, streamLoading, overview]);
}
