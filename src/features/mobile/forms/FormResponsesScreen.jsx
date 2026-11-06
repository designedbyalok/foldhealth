import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { Avatar } from '../../../components/Avatar/Avatar';
import { useAppStore } from '../../../store/useAppStore';
import { leafFields } from '../../forms/analytics/aggregate';
import { fmtDate, formatAnswerValue } from '../../forms/analytics/formAnalyticsUi';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { initialsOf } from '../mobileFormat';
import common from '../mobile.module.css';
import more from '../more/more.module.css';
import styles from './forms.module.css';

const TABS = [
  { key: 'completed', label: 'Completed' },
  { key: 'pending', label: 'In progress' },
];

/** A form's responses, read-only (desktop form Responses tab): who, when, scores and answers. */
export function FormResponsesScreen({ id, name }) {
  const fetchFormById = useAppStore(s => s.fetchFormById);
  const fetchFormResponses = useAppStore(s => s.fetchFormResponses);
  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState(null);
  const [tab, setTab] = useState('completed');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let live = true;
    Promise.all([fetchFormById(id), fetchFormResponses(id)]).then(([f, r]) => {
      if (!live) return;
      setForm(f);
      setResponses(r || []);
    });
    return () => { live = false; };
  }, [id, fetchFormById, fetchFormResponses]);

  const leaves = useMemo(() => leafFields(form?.schema?.items || []), [form]);
  const scoreDefs = form?.scoring?.scores || [];
  const list = (responses || []).filter(r => (tab === 'pending' ? r.status === 'in_progress' : r.status !== 'in_progress'));
  const active = openId != null ? (responses || []).find(r => r.id === openId) : null;

  return (
    <div className={common.screen}>
      <MobileSubHeader title="Responses">
        <p className={styles.sub}>{form?.name || name}</p>
      </MobileSubHeader>
      <div className={more.toolbar}>
        <SegmentedControl size="lg" fullWidth aria-label="Response status" items={TABS} value={tab} onValueChange={setTab} />
      </div>
      <div className={common.body}>
        {responses == null ? <MobileListSkeleton height={72} /> : list.length === 0 ? (
          <MobileEmpty icon="solar:inbox-linear" title={tab === 'pending' ? 'No fills in progress' : 'No responses yet'} />
        ) : (
          <div className={`${more.stack} ${more.tight}`}>
            {list.map(r => {
              const who = r.submittedByName || 'Anonymous';
              const pending = r.status === 'in_progress';
              return (
                <button key={r.id} type="button" className={styles.card} onClick={() => setOpenId(r.id)}>
                  <Avatar variant="staff" size="L" initials={initialsOf(who)} userName={who} />
                  <span className={styles.text}>
                    <span className={styles.name}>{who}</span>
                    <span className={styles.sub}>{pending ? `Started ${fmtDate(r.startedAt)}` : `Received ${fmtDate(r.createdAt)}`}</span>
                    {!pending && scoreDefs.length > 0 && (
                      <span className={styles.badges}>
                        {scoreDefs.map(def => {
                          const snap = (r.scores?.scores || []).find(s => s.id === def.id);
                          return <Badge key={def.id} size="sm" label={`${def.label}: ${snap?.value ?? '-'}${snap?.band?.label ? ` (${snap.band.label})` : ''}`} />;
                        })}
                      </span>
                    )}
                    {pending && r.answeredCount != null && <span className={styles.sub}>{r.answeredCount} of {leaves.length} answered</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {active && (
        <BottomSheet title={active.submittedByName || 'Anonymous'} onClose={() => setOpenId(null)}>
          <dl className={styles.answers}>
            {leaves.map(f => (
              <div key={f.linkId} className={styles.answer}>
                <dt className={styles.question}>{f.text}</dt>
                <dd className={styles.value}>{formatAnswerValue(active.answers?.[f.linkId])}</dd>
              </div>
            ))}
          </dl>
        </BottomSheet>
      )}
    </div>
  );
}
