import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { supabase } from '../../../lib/supabase';
import { useAppStore } from '../../../store/useAppStore';
import { formShareLink } from '../../forms/formLink';
import { listEducationContent } from '../../messages/comms/commsRepo';
import { formatPhone, toE164 } from '../../messages/comms/commsUtils';
import { useCommsPeople } from '../../messages/comms/useCommsPeople';
import {
  DEFAULT_ID_VERIFICATION, verifyBlockers, protectSms, SECURE_SMS_PREFIX, SECURE_SMS_TEXT,
  withDecisionMakers, pickOneDecisionMaker, verifyForSendTo,
} from '../../messages/comms/sendTo';
import { VerifyIdCard } from '../../messages/comms/VerifyIdCard';
import { Field, SendToList } from './MessageForm';
import styles from './messageForm.module.css';

const loadForms = () => supabase.from('forms').select('id, name')
  .order('updated_at', { ascending: false, nullsFirst: false }).limit(100)
  .then(({ data }) => (data || []).map(f => ({ id: String(f.id), name: f.name, url: formShareLink(f.id) })));

const loadArticles = () => listEducationContent()
  .then(list => (list || []).map(a => ({ id: String(a.id), name: a.title, url: a.url })));

// Desktop ThreadShareDrawers: Send Form / Send Article.
const KINDS = {
  form: {
    title: 'Send Form', itemLabel: 'Form', cta: 'Add Form Link', load: loadForms,
    line: (name, f) => `Please fill this form for ${name}: \n${f.name}: ${f.url}`,
    metaFor: f => ({ kind: 'assessment', formIds: [f.id] }),
  },
  article: {
    title: 'Send Article', itemLabel: 'Article', cta: 'Add Article Link', load: loadArticles,
    line: (name, a) => `Please read this article for ${name}: \n${a.name}: ${a.url}`,
    metaFor: a => ({ kind: 'education', contentId: a.id }),
  },
};

/**
 * Pick a form or article for a Chat or SMS thread; its line goes into the
 * thread's message box and the thread's Send sends it (to each person picked
 * on SMS). Same rules as desktop ThreadLinkDrawer.
 */
export function ShareLinkSheet({ conversation, kind, forName, onInsert, onClose }) {
  const k = KINDS[kind];
  const { patients } = useCommsPeople();
  const sms = conversation.channel === 'sms';
  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState('');
  const [query, setQuery] = useState('');
  const [verifyId, setVerifyId] = useState(DEFAULT_ID_VERIFICATION);

  useEffect(() => {
    let alive = true;
    k.load().then((list) => { if (alive) setItems(list); });
    return () => { alive = false; };
  }, [k]);

  const patient = useMemo(() => {
    const p = patients.find(x => String(x.id) === String(conversation.patient_id));
    return { ...(p || {}), id: conversation.patient_id, name: conversation.patient_name, email: conversation.patient_email || p?.email, phone: conversation.patient_phone || p?.phone };
  }, [patients, conversation]);
  const contacts = useAppStore(st => (patient.id != null ? st.patientContacts[patient.id] : null));
  const fetchPatientContacts = useAppStore(st => st.fetchPatientContacts);
  useEffect(() => { if (patient.id != null) fetchPatientContacts(patient.id); }, [patient.id, fetchPatientContacts]);
  const people = [
    { value: 'patient', name: patient.name, phone: patient.phone, email: patient.email, dob: patient.dob, type: 'Patient' },
    ...(contacts ? withDecisionMakers(contacts) : []).map(c => ({ value: String(c.id), name: c.name, phone: c.phone, email: c.email, dob: c.dob, type: c.type, missing: c.missing })),
  ];
  const [picked, setPicked] = useState(() => (patient.phone ? ['patient'] : []));
  const hasRoles = sms && (contacts || []).length > 0;
  const targets = hasRoles ? people.filter(p => picked.includes(p.value) && p.phone)
    : sms ? (patient.phone ? [patient] : []) : [patient];
  const pick = (v) => {
    const next = pickOneDecisionMaker(v, picked, x => people.find(p => p.value === x)?.type);
    const on = verifyForSendTo(next, picked);
    if (on !== null) setVerifyId(x => ({ ...x, on }));
    setPicked(next);
  };

  const item = items.find(i => i.id === itemId);
  const withOthers = hasRoles && targets.some(t => t.value !== 'patient');
  const activeVerify = withOthers ? verifyId : { ...verifyId, on: false };
  const blockers = verifyBlockers(activeVerify, targets);
  const canAdd = !!item && targets.length > 0 && !blockers.length;

  const add = () => {
    if (!canAdd) return;
    const name = forName || patient.name;
    const plain = k.line(name, item);
    const secured = activeVerify.on ? protectSms(plain) : null;
    const body = secured ? secured.text.slice(SECURE_SMS_PREFIX) : plain;
    onInsert({
      text: secured && sms ? `${SECURE_SMS_TEXT} ${body}` : body,
      meta: { ...k.metaFor(item), ...(secured ? { verifyId, secureLinks: secured.links } : {}) },
      targets: sms ? targets.map(t => toE164(t.phone)) : null,
      forName: name,
    });
    onClose();
  };

  const q = query.trim().toLowerCase();
  const list = items.filter(i => !q || i.name.toLowerCase().includes(q));
  return (
    <BottomSheet title={sms ? `${k.title} via SMS` : k.title} onClose={onClose}>
      <div className={styles.sheetBody}>
        <Field label="Member"><span className={styles.personName}>{patient.name}</span></Field>
        {hasRoles && (
          <Field label="Send To" required>
            <SendToList
              people={people.map(p => ({ ...p, meta: p.phone ? formatPhone(p.phone) : 'No phone number on record', disabled: !p.phone }))}
              value={picked}
              onChange={pick}
            />
          </Field>
        )}
        {withOthers && <VerifyIdCard value={verifyId} onChange={setVerifyId} blockers={blockers} />}
        <Field label={k.itemLabel} required>
          <Input size="lg" type="search" leadingIcon="solar:magnifer-linear" placeholder={`Search ${k.itemLabel}`} aria-label={`Search ${k.itemLabel.toLowerCase()}`} value={query} onValueChange={setQuery} />
          <div className={`${styles.people} ${styles.sheetList}`} role="radiogroup" aria-label={k.itemLabel}>
            {list.length === 0 ? <span className={`${styles.person} ${styles.personMeta}`}>Nothing found</span> : list.map(i => (
              <button key={i.id} type="button" role="radio" aria-checked={i.id === itemId} className={styles.person} onClick={() => setItemId(i.id)}>
                <span className={styles.personText}><span className={styles.personName}>{i.name}</span></span>
                {i.id === itemId && <Icon name="solar:check-circle-linear" size={24} color="var(--primary-300)" />}
              </button>
            ))}
          </div>
        </Field>
        <Button size="lg" fullWidth onClick={add} disabled={!canAdd}>{k.cta}</Button>
      </div>
    </BottomSheet>
  );
}
