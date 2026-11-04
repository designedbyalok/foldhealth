/**
 * Responses tab: master/detail. Left: searchable respondent list with a
 * Responded/Pending toggle. Right: the selected response, showing every
 * question with its answer + the cross-response average, plus a section per
 * score group with that response's score + interpretation.
 */
import { useMemo, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Tabs } from '../../../components/Tabs/Tabs';
import { leafFields, answerAverage, responseCompletion } from './aggregate';
import { fieldIcon, initials, fmtDate, formatAnswerValue, SEV_COLOR } from './formAnalyticsUi';
import styles from './FormAnalyticsPanel.module.css';
import { isEmptyDash } from '../../../lib/emptyDash';

function QaRow({ field, response, avg }) {
  const v = response.answers?.[field.linkId];
  const answered = v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
  // Long free-text answers render in a full-width box below the row.
  const isLong = field.type === 'text';
  return (
    <>
      <div className={styles.qaRow}>
        <span className={styles.qIcon} style={{ background: answered ? 'var(--status-success)' : 'var(--neutral-150)' }}>
          <Icon name={fieldIcon(field)} size={15} color="#fff" />
        </span>
        <span className={styles.qaText}>{field.text}{field.required && <span className={styles.qReq}>*</span>}</span>
        {!isLong && <span className={styles.qaAnswer}>Answer:<strong> {formatAnswerValue(v)}</strong></span>}
        {!isLong && !isEmptyDash(avg) && <span className={styles.qaAvg}>Avg.: {avg}</span>}
      </div>
      {isLong && answered && <div className={styles.longAnswer}>{formatAnswerValue(v)}</div>}
    </>
  );
}

export function ResponsesView({ fields, scoring, formName, completed, pending }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('responded');
  const [activeId, setActiveId] = useState(completed[0]?.id ?? pending[0]?.id ?? null);
  const leaves = useMemo(() => leafFields(fields), [fields]);

  const source = tab === 'responded' ? completed : pending;
  const detailList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return source.filter((r) => !q || (r.submittedByName || 'Anonymous').toLowerCase().includes(q));
  }, [source, query]);

  const all = useMemo(() => [...completed, ...pending], [completed, pending]);
  const active = all.find((r) => r.id === activeId) || detailList[0] || null;
  const activeIsPending = active?.status === 'in_progress';
  const scoreDefs = scoring?.scores || [];
  const leavesById = useMemo(() => {
    const m = new Map();
    for (const f of leaves) m.set(f.linkId, f);
    return m;
  }, [leaves]);
  const visibleLeaves = useMemo(() => {
    if (!activeIsPending) return leaves;
    const out = [];
    for (const f of leaves) {
      const v = active?.answers?.[f.linkId];
      if (v != null && v !== '') out.push(f);
    }
    return out;
  }, [leaves, activeIsPending, active]);

  // Cross-response averages are computed over completed submissions only.
  const avgSource = completed;

  return (
    <div className={styles.respLayout}>
      {/* Left list */}
      <div className={styles.respList}>
        <div className={styles.respSearch}>
          <Input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className={styles.respTabs}>
          <Tabs
            embedded
            items={[
              { key: 'responded', label: 'Responded', count: completed.length },
              { key: 'pending', label: 'Pending', count: pending.length },
            ]}
            value={tab}
            onValueChange={setTab}
          />
        </div>
        <div className={styles.respItems}>
          {detailList.length === 0 ? (
            <div className={styles.empty} style={{ padding: '48px 16px' }}>
              <Icon name="solar:inbox-linear" size={28} color="var(--neutral-150)" />
              <span className={styles.emptyDesc}>{tab === 'pending' ? 'No pending invites.' : 'No responses found.'}</span>
            </div>
          ) : (
            detailList.map((r) => {
              const name = r.submittedByName || 'Anonymous';
              const isPending = r.status === 'in_progress';
              return (
                <button key={r.id} className={`${styles.respItem} ${r.id === active?.id ? styles.respItemActive : ''}`} onClick={() => setActiveId(r.id)}>
                  <Avatar variant="staff" initials={initials(name)} className={styles.avatar} />
                  <span className={styles.respItemBody}>
                    <span className={styles.respName}>{name}</span>
                    <span className={styles.respSub}>
                      {isPending ? `Started ${fmtDate(r.startedAt)}` : `Received ${fmtDate(r.createdAt)}`}
                    </span>
                  </span>
                  <Icon name="solar:alt-arrow-right-linear" size={14} color="var(--neutral-200)" />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Detail */}
      <div className={styles.respDetail}>
        {!active ? (
          <div className={styles.empty}>
            <Icon name="solar:inbox-linear" size={32} color="var(--neutral-150)" />
            <span className={styles.emptyTitle}>No response selected</span>
            <span className={styles.emptyDesc}>Select a respondent from the list to view their answers.</span>
          </div>
        ) : (
          <div className={styles.detailScroll}>
            {(() => {
              const name = active.submittedByName || 'Anonymous';
              const comp = responseCompletion(fields, active);
              return (
                <>
                  <div className={styles.detailHead}>
                    <div className={styles.detailWho}>
                      <Avatar variant="staff" size={40} initials={initials(name)} className={styles.avatar} />
                      <div>
                        <div className={styles.detailName}>{name}</div>
                        <div className={styles.detailMeta}>{formName} · {activeIsPending ? 'in progress' : 'response'}</div>
                      </div>
                    </div>
                    <div className={styles.detailDates}>
                      {activeIsPending
                        ? <div>Started on:<strong>{fmtDate(active.startedAt)}</strong></div>
                        : <div>Received on:<strong>{fmtDate(active.createdAt)}</strong></div>}
                    </div>
                  </div>

                  <div className={styles.detailStatsRow}>
                    <div className={styles.statChips}>
                      <span className={styles.statChip}>Total Questions <span className={styles.statChipNum}>{comp.total}</span></span>
                      <span className={styles.statChip}>Answered <span className={styles.statChipNum}>{comp.answered}</span></span>
                      <span className={styles.statChip}>Not Answered <span className={styles.statChipNum}>{comp.notAnswered}</span></span>
                    </div>
                    {!activeIsPending && scoreDefs.length > 0 && (
                      <span className={styles.linkedScores}>{scoreDefs.length} Linked Score Group{scoreDefs.length === 1 ? '' : 's'}</span>
                    )}
                  </div>

                  {/* Questions: for an in-progress fill, only the answered ones. */}
                  {visibleLeaves.map((f) => (
                      <QaRow key={f.linkId} field={f} response={active} avg={answerAverage(f, avgSource)} />
                    ))}

                  {activeIsPending ? (
                    <div className={styles.incompleteBox}>
                      <Icon name="solar:clipboard-remove-linear" size={36} color="var(--neutral-150)" />
                      <span className={styles.incompleteTitle}>Form Incomplete</span>
                      <span className={styles.incompleteDesc}>This user started but hasn’t completed the form yet.</span>
                      <div className={styles.statusCard}>
                        <span className={styles.statusCardLabel}>Status</span>
                        <span className={styles.statusCardValue}>In Progress</span>
                      </div>
                    </div>
                  ) : (
                    /* Score group sections (completed responses only) */
                    scoreDefs.map((def) => {
                      const snap = (active.scores?.scores || []).find((s) => s.id === def.id);
                      const members = [];
                      for (const s of def.sources || []) {
                        const f = leavesById.get(s.linkId);
                        if (f) members.push(f);
                      }
                      return (
                        <div key={def.id}>
                          <div className={styles.sgSectionHead}>
                            <span className={styles.sgSectionTitle}>Score Group:<strong> {def.label}</strong></span>
                            <span className={styles.sgSectionMeta}>
                              Interpretation:
                              <strong style={{ color: snap?.band ? SEV_COLOR[snap.band.severity] : 'var(--neutral-400)' }}>
                                {snap?.band?.label || 'NA'}
                              </strong>
                              <span style={{ marginLeft: 16 }}>Score:<strong>{snap?.value ?? '-'}</strong></span>
                            </span>
                          </div>
                          {members.map((f) => (
                            <QaRow key={f.linkId} field={f} response={active} avg={answerAverage(f, avgSource)} />
                          ))}
                        </div>
                      );
                    })
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

export default ResponsesView;
