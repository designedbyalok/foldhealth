import { supabase } from '../../lib/supabase';
import { referralToRow } from '../../features/patient/data/patientReferrals';
import { orderToRow, rowToOrder } from '../../features/patient/data/patientOrders';
import { uploadPatientReferralAttachment } from '../lib/patientReferralAttachment';

const isMissingTable = error => error?.code === '42P01' || error?.code === 'PGRST205';

/*
 * Orders & Referrals tab: creating referrals (patient_referrals) and the
 * lab / imaging orders (patient_orders). Until a table exists, new rows are
 * flagged `local` and last the session.
 */
export const createPatientOrdersSlice = (set, get) => {
  const prepend = (key, patientId, item) => set(s => ({ [key]: { ...s[key], [patientId]: [item, ...(s[key][patientId] || [])] } }));
  const patch = (key, patientId, id, fn) => set(s => ({ [key]: { ...s[key], [patientId]: (s[key][patientId] || []).map(x => (x.id === id ? fn(x) : x)) } }));
  const drop = (key, patientId, id) => set(s => ({ [key]: { ...s[key], [patientId]: (s[key][patientId] || []).filter(x => x.id !== id) } }));

  // Optimistic insert shared by both tables. Resolves true when the row stays.
  const insertOptimistic = async ({ key, table, patientId, item, row, failMessage }) => {
    prepend(key, patientId, item);
    const { error } = await supabase.from(table).insert(row);
    if (!error) return true;
    if (isMissingTable(error)) {
      patch(key, patientId, item.id, x => ({ ...x, local: true }));
      return true;
    }
    console.warn(`insert ${table}:`, error.message);
    drop(key, patientId, item.id);
    get().showToast?.(failMessage);
    return false;
  };

  return {
    // values: { referredTo, specialty, referredBy, reason, priority, status, file }
    createPatientReferral: async (patientId, values) => {
      if (!patientId) return false;
      const id = crypto.randomUUID();
      // `files` are new uploads; `docs` are the patient's Documents picked in
      // the form, kept by reference.
      const uploaded = await Promise.all((values.files || []).map(f => uploadPatientReferralAttachment(patientId, id, f)));
      const referral = {
        id,
        patientId: String(patientId),
        referredByName: get().currentActorName(),
        referredBySpecialty: values.referredBySpecialty || '',
        referredToName: values.providerName,
        referredToSpecialty: values.providerSpecialty,
        status: values.status,
        reason: values.reason,
        priority: 'Routine',
        note: values.note || '',
        attachments: [...uploaded, ...(values.docs || [])],
        createdAt: new Date().toISOString(),
      };
      return insertOptimistic({
        key: 'patientReferrals', table: 'patient_referrals', patientId, item: referral, row: referralToRow(referral), failMessage: 'Could not save the referral',
      });
    },

    patientOrders: {},           // { [patientId]: order[] }
    patientOrdersLoadedFor: {},  // { [patientId]: true }: gates the skeleton
    fetchPatientOrders: async (patientId) => {
      if (!patientId) return;
      const { data, error } = await supabase.from('patient_orders')
        .select('*').eq('patient_id', String(patientId)).order('created_at', { ascending: false });
      if (error && !isMissingTable(error)) console.warn('fetchPatientOrders:', error.message);
      set(s => ({
        patientOrders: { ...s.patientOrders, [patientId]: error ? (s.patientOrders[patientId] || []).filter(o => o.local) : (data || []).map(rowToOrder) },
        patientOrdersLoadedFor: { ...s.patientOrdersLoadedFor, [patientId]: true },
      }));
    },
    // values: { type, name, reason, priority, status, orderedBy, dueDate, notes }
    createPatientOrder: async (patientId, values) => {
      if (!patientId) return false;
      const order = {
        id: crypto.randomUUID(),
        patientId: String(patientId),
        type: values.type,
        name: values.name,
        reason: values.reason,
        priority: values.priority,
        status: values.status,
        orderedBy: values.orderedBy || get().currentActorName(),
        dueDate: values.dueDate || null,
        notes: values.notes,
        createdAt: new Date().toISOString(),
      };
      return insertOptimistic({
        key: 'patientOrders', table: 'patient_orders', patientId, item: order, row: orderToRow(order), failMessage: 'Could not save the order',
      });
    },
  };
};
