import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Select } from '../../../components/Select/Select';
import { supabase } from '../../../lib/supabase';
import { formShareLink } from '../../forms/formLink';
import { listEducationContent } from './commsRepo';
import { useCommsPeople } from './useCommsPeople';
import {
  DEFAULT_ID_VERIFICATION, verifyBlockers, protectSms, SECURE_SMS_PREFIX, SECURE_SMS_TEXT,
  personMeta, withDecisionMakers, pickOneDecisionMaker, verifyForSendTo, SEND_TO_INFO, SEND_TO_PLACEHOLDER, sendToChipLabel,
} from './sendTo';
import { formatPhone, toE164 } from './commsUtils';
import { PersonOption, PersonTip } from './PersonOption';
import { SendToPicker } from './SendToPicker';
import { VerifyIdCard, VerifyIdReveal } from './VerifyIdCard';
import styles from './CommsDrawers.module.css';

const loadForms = () => supabase.from('forms').select('id, name')
  .order('updated_at', { ascending: false, nullsFirst: false }).limit(100)
  .then(({ data }) => (data || []).map(f => ({ id: String(f.id), name: f.name, url: formShareLink(f.id) })));

const loadArticles = () => listEducationContent()
  .then(list => (list || []).map(a => ({ id: String(a.id), name: a.title, url: a.url })));

/**
 * Shared by Send Form and Send Article, from a Chat or SMS thread's type box:
 * pick one item, who it's for (SMS) and whether its link needs Verify
 * identity; the main button puts the message in the thread's message box and
 * the thread's Send sends it (to each person picked).
 *
 * forName – who the line names ("Please fill this form for …"); defaults to the thread's patient
 * onInsert({ text, meta, targets, forName }) – targets: E.164 numbers (SMS only)
 */
function ThreadLinkDrawer({ conversation, forName, onInsert, onClose, load, itemLabel, cta, title, line, metaFor }) {
  const { patients } = useCommsPeople();
  const sms = conversation.channel === 'sms';
  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState('');
  const [verifyId, setVerifyId] = useState(DEFAULT_ID_VERIFICATION);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let alive = true;
    load().then((list) => { if (alive) setItems(list); });
    return () => { alive = false; };
  }, [load]);

  // The thread's patient and their recorded contacts; on SMS, someone
  // without a phone is listed but can't be picked.
  const patient = useMemo(() => {
    const p = patients.find(x => String(x.id) === String(conversation.patient_id));
    return { ...(p || {}), id: conversation.patient_id, name: conversation.patient_name, email: conversation.patient_email || p?.email, phone: conversation.patient_phone || p?.phone };
  }, [patients, conversation]);
  const contacts = useAppStore(st => (patient.id != null ? st.patientContacts[patient.id] : null));
  const fetchPatientContacts = useAppStore(st => st.fetchPatientContacts);
  useEffect(() => { if (patient.id != null) fetchPatientContacts(patient.id); }, [patient.id, fetchPatientContacts]);
  const people = [
    { value: 'patient', name: patient.name, phone: patient.phone, email: patient.email, dob: patient.dob, type: 'Patient', initials: patient.initials, meta: personMeta(patient) },
    ...(contacts ? withDecisionMakers(contacts) : []).map(c => ({ value: String(c.id), name: c.name, phone: c.phone, email: c.email, dob: c.dob, type: c.type, missing: c.missing, meta: personMeta(c) })),
  ];
  const [picked, setPicked] = useState(() => (patient.phone ? ['patient'] : []));
  // Send To (and with it Verify identity) only shows on SMS when the member
  // has other people on record; otherwise it goes to the member.
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
  // Protect links only matters once the link goes to someone besides the patient.
  const withOthers = hasRoles && targets.some(t => t.value !== 'patient');
  const activeVerify = withOthers ? verifyId : { ...verifyId, on: false };
  const blockers = verifyBlockers(activeVerify, targets);
  const canAdd = !!item && targets.length > 0 && !blockers.length;
  // Why the button is greyed out, the first thing missing.
  const blockedReason = !item ? `Pick ${itemLabel === 'Article' ? 'an' : 'a'} ${itemLabel.toLowerCase()}`
    : !targets.length ? (hasRoles ? 'Pick someone with a phone number in Send To' : "This member doesn't have a phone number on record")
      : blockers.length ? "Someone in Send To can't verify their identity"
        : null;

  const add = () => {
    if (!canAdd) return;
    // "[You have a secure message from Fold Health. ]{line}". The opening
    // sentence only comes with Verify identity on an SMS; Chat just gets the
    // link swapped.
    // On a shared number the line names the thread's Log For member.
    const name = forName || patient.name;
    const plain = line(name, item);
    const secured = activeVerify.on ? protectSms(plain) : null;
    const body = secured ? secured.text.slice(SECURE_SMS_PREFIX) : plain;
    onInsert?.({
      text: secured && sms ? `${SECURE_SMS_TEXT} ${body}` : body,
      meta: { ...metaFor(item), ...(secured ? { verifyId, secureLinks: secured.links } : {}) },
      targets: sms ? targets.map(t => toE164(t.phone)) : null,
      forName: name,
    });
    setClosing(true);
  };

  return (
    <Drawer
      title={sms ? `${title} via SMS` : title}
      onClose={onClose}
      dismissed={closing}
      primaryAction={<Button onClick={add} disabled={!canAdd} disabledReason={blockedReason}>{cta}</Button>}
    >
      <div className={styles.form}>
        {/* The thread's member, shown for context; it can't be changed here. */}
        <Select
          label="Member"
          disabled
          options={[{ value: 'member', triggerLabel: patient.name, label: patient.name }]}
          value="member"
          onChange={() => {}}
        />
        {hasRoles && (
          <SendToPicker
            showInfo
            infoText={SEND_TO_INFO}
            options={people.map(o => ({
              value: o.value,
              triggerLabel: sendToChipLabel(o.name, o.type),
              searchText: `${o.name} ${o.type} ${o.phone || ''}`,
              disabled: !o.phone,
              label: <PersonOption name={o.name} initials={o.initials} meta={o.phone ? formatPhone(o.phone) : 'No phone number on record'} tag={o.type} />,
              badgeTooltip: <PersonTip name={o.name} initials={o.initials} email={o.phone ? formatPhone(o.phone) : ''} tag={o.type} />,
            }))}
            value={picked}
            onChange={pick}
            placeholder={SEND_TO_PLACEHOLDER}
          >
            {/* The item is required, so there's always a link; Protect links
                shows under Send To once someone besides the patient gets it. */}
            <VerifyIdReveal show={withOthers}>
              <VerifyIdCard value={verifyId} onChange={setVerifyId} blockers={blockers} />
            </VerifyIdReveal>
          </SendToPicker>
        )}
        <Select
          label={itemLabel}
          required
          searchable
          searchPlaceholder={`Search ${itemLabel.toLowerCase()}`}
          options={items.map(i => ({ value: i.id, label: i.name }))}
          value={itemId}
          onChange={setItemId}
          placeholder={`Search ${itemLabel}`}
        />
      </div>
    </Drawer>
  );
}

/** Send Form: one form's link, into the thread's message box. */
export function SendFormDrawer(props) {
  return (
    <ThreadLinkDrawer
      {...props}
      load={loadForms}
      itemLabel="Form"
      cta="Add Form Link"
      title="Send Form"
      line={(name, f) => `Please fill this form for ${name}: \n${f.name}: ${f.url}`}
      metaFor={(f) => ({ kind: 'assessment', formIds: [f.id] })}
    />
  );
}

/** Send Article: one article's link, into the thread's message box. */
export function SendArticleDrawer(props) {
  return (
    <ThreadLinkDrawer
      {...props}
      load={loadArticles}
      itemLabel="Article"
      cta="Add Article Link"
      title="Send Article"
      line={(name, a) => `Please read this article for ${name}: \n${a.name}: ${a.url}`}
      metaFor={(a) => ({ kind: 'education', contentId: a.id })}
    />
  );
}
