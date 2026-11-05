// Overview cards backed by the patient's p360_profiles row: contact and
// reachability, care team, caregivers, medications, diagnoses.
import { lazy, Suspense, useEffect, useState } from 'react';
import { DashboardCard, DashboardCardBody, DashboardCardSkeleton } from '../../../../../../components/DashboardCard/DashboardCard';
import { PanelSectionItem } from '../../../../../../components/PanelSection/PanelSection';
import { CappedRows } from './CappedRows';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { formatClinicalDate } from '../../../../../../lib/clinicalDates';
import { medHighlights, RECENT_DAYS } from './medHighlights';
import { Badge } from '../../../../../../components/Badge/Badge';
import { Avatar } from '../../../../../../components/Avatar/Avatar';
import { Icon } from '../../../../../../components/Icon/Icon';
import { useAppStore } from '../../../../../../store/useAppStore';
import { findWorklistMember, icdFromText } from './overviewItemActions';
import { useP360Profile } from './useP360Profile';
import { usePatientCareTeam } from '../../../../care-team/usePatientCareTeam';
import styles from './overviewCards.module.css';
import { isProgramClosed } from '../../../../data/programStatus';
import { Button } from '../../../../../../components/Button/Button';
import { CardHeaderActions, CardInsights } from '../attention/CardInsights';

const AddMedicationsDrawer = lazy(() => import('../../../../left-panel/tabs/pami-hx/AddMedicationsDrawer/AddMedicationsDrawer').then(m => ({ default: m.AddMedicationsDrawer })));
const AddProblemsDrawer = lazy(() => import('../../../../left-panel/tabs/pami-hx/AddProblemsDrawer/AddProblemsDrawer').then(m => ({ default: m.AddProblemsDrawer })));

const list = v => (Array.isArray(v) ? v.filter(Boolean) : []);

// Shared frame: skeleton while the profile loads, one empty line without one.
function ProfileCard({ patientId, icon, title, count, bodyClassName, children }) {
  const profile = useP360Profile(patientId);
  const [insightsOpen, setInsightsOpen] = useState(false);
  if (profile === undefined) return <DashboardCardSkeleton icon={icon} title={title} rows={2} />;
  return (
    <DashboardCard icon={icon} title={title} count={profile ? count?.(profile) : null} actions={<CardHeaderActions insightsOpen={insightsOpen} onToggleInsights={() => setInsightsOpen(v => !v)}></CardHeaderActions>}>
      <CardInsights open={insightsOpen} />
      <DashboardCardBody className={bodyClassName}>
        {profile ? children(profile) : <p className={styles.empty}>No profile data for this patient yet.</p>}
      </DashboardCardBody>
    </DashboardCard>
  );
}

function lastContactLabel(type, days) {
  if (!type) return null;
  const label = type === 'UTR' ? 'Unable to reach' : type === 'Attended' ? 'Attended visit' : type;
  if (days == null) return label;
  const when = Number(days) === 0 ? 'today' : `${days} day${Number(days) === 1 ? '' : 's'} ago`;
  return `${label}, ${when}`;
}

export function ContactCard({ patientId }) {
  return (
    <ProfileCard patientId={patientId} icon="solar:phone-linear" title="Contact & Reachability" bodyClassName={styles.listBody}>
      {(p) => {
        const optedOut = list(p.opted_out_comms).filter(o => o !== 'None');
        const languages = list(p.languages).filter(l => l !== p.language_preference);
        const last = lastContactLabel(p.last_contact_type, p.last_contact_days);
        return (
          <>
            <PanelSectionItem
              inset
              leading={<span className={`${styles.tile} ${p.last_contact_type === 'UTR' ? styles.error : ''}`}><Icon name="solar:chat-round-dots-linear" size={16} /></span>}
              title="Last contact"
              meta={last || 'No contact recorded'}
            />
            <PanelSectionItem
              inset
              leading={<span className={styles.tile}><Icon name="solar:global-linear" size={16} /></span>}
              title="Preferred language"
              meta={[p.language_preference || 'Not set', languages.length ? `Also ${languages.join(', ')}` : null]}
            />
            <PanelSectionItem
              inset
              leading={<span className={`${styles.tile} ${optedOut.length ? styles.warning : styles.success}`}><Icon name="solar:shield-check-linear" size={16} /></span>}
              title={optedOut.length ? `Opted out of ${optedOut.length} channel${optedOut.length === 1 ? '' : 's'}` : 'Reachable on all channels'}
              meta={optedOut.length ? optedOut.join(' • ') : 'No opt-outs on file'}
              wrapTitle
            />
          </>
        );
      }}
    </ProfileCard>
  );
}

export function CareTeamCard({ patientId }) {
  const programs = useAppStore(s => s.careProgramsByPatient[patientId]);
  const fetchCareProgramsForPatient = useAppStore(s => s.fetchCareProgramsForPatient);
  // Program owners come from care programs, which the programs card may not have loaded.
  useEffect(() => { if (patientId) fetchCareProgramsForPatient(patientId); }, [patientId, fetchCareProgramsForPatient]);
  // The team lives in patient_care_team, so it shows with or without a profile.
  const { team, loading } = usePatientCareTeam(patientId);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const icon = 'solar:users-group-rounded-linear';
  if (loading) return <DashboardCardSkeleton icon={icon} title="Care Team" rows={2} />;

  const active = (programs || []).filter(pr => !isProgramClosed(pr.status));
  const owned = {};
  active.forEach((pr) => {
    if (pr.assignee && pr.assignee !== 'Unassigned') (owned[pr.assignee] ||= []).push(pr.code);
  });
  const teamNames = new Set(team.map(m => m.name));
  // Program owners who are not on the care team still belong here.
  const owners = Object.keys(owned).filter(n => !teamNames.has(n)).map(name => ({
    name, title: 'Program owner', initials: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
  }));
  const unassigned = active.filter(pr => !pr.assignee || pr.assignee === 'Unassigned').length;
  const members = [...team, ...owners];
  return (
    <DashboardCard icon={icon} title="Care Team" count={team.length || null} actions={<CardHeaderActions insightsOpen={insightsOpen} onToggleInsights={() => setInsightsOpen(v => !v)}></CardHeaderActions>}>
      <CardInsights open={insightsOpen} />
      <DashboardCardBody className={styles.listBody}>
        {members.length === 0 ? <p className={styles.empty}>No care team assigned.</p> : (
          <>
            {/* What needs fixing leads: programs nobody owns. */}
            {unassigned > 0 && (
              <p className={`${styles.textWarning} ${styles.listNote}`}>{unassigned} active program{unassigned === 1 ? ' has' : 's have'} no owner.</p>
            )}
            <CappedRows
              items={members}
              render={m => (
                <PanelSectionItem
                  key={`${m.name}|${m.role || ''}`}
                  inset
                  leading={<Avatar variant="assignee" initials={m.initials} />}
                  title={m.name}
                  meta={[m.title, owned[m.name] && `Owns ${owned[m.name].join(', ')}`]}
                  trailing={m.role ? <span className={styles.statusSlotWide}><Badge size="sm" label={m.role} /></span> : null}
                />
              )}
            />
          </>
        )}
      </DashboardCardBody>
    </DashboardCard>
  );
}

export function CaregiversCard({ patientId }) {
  return (
    <ProfileCard patientId={patientId} icon="solar:users-group-two-rounded-linear" title="Caregiver & Family" count={p => list(p.family_members).length || null} bodyClassName={styles.listBody}>
      {(p) => {
        const family = list(p.family_members);
        if (family.length === 0) return <p className={styles.empty}>No caregivers or family on file.</p>;
        return (
          <CappedRows
            items={family}
            render={m => {
              const role = m.role || '';
              const relation = String(m.relation || '');
              const authority = /caregiver|poa|power of attorney/i.test(`${role} ${relation}`);
              const alreadyNamed = role && relation.toLowerCase().includes(role.toLowerCase());
              return (
                <PanelSectionItem
                  key={`${m.name}-${m.relation}`}
                  inset
                  leading={<Avatar variant="assignee" initials={m.initials} />}
                  title={m.name}
                  meta={[m.relation, m.phone, m.phone_hours]}
                  trailing={authority && role && !alreadyNamed
                    ? <span className={styles.statusSlotWide}><Badge tone="info" size="sm" label={role} /></span>
                    : null}
                />
              );
            }}
          />
        );
      }}
    </ProfileCard>
  );
}

// The patient's medications (the PAMI/Hx tab's records) with what changed
// leading: refills due or run out, new starts and recent stops (medHighlights).
// Everything stopped sits behind the Discontinued link.
const MED_CHANGE = {
  out: { label: 'Ran out', tone: 'error', meta: d => `Ran out ${d}` },
  refill: { label: 'Refill due', tone: 'warning', meta: d => `Refill due ${d}` },
  new: { label: 'New', tone: 'success', meta: d => `Started ${d}` },
  stopped: { label: 'Stopped', tone: 'grey', meta: d => `Stopped ${d}` },
};
const pad2 = n => String(n).padStart(2, '0');
const fmtDay = (ms) => { const d = new Date(ms); return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`; };
const MED_SUMMARY = [['out', 'ran out', 'ran out'], ['refill', 'refill due', 'refills due'], ['new', 'new', 'new'], ['stopped', 'stopped', 'stopped']];

export function MedicationsCard({ patientId }) {
  const stored = useAppStore(s => s.patientMedications[patientId]);
  const fetchPatientMedications = useAppStore(s => s.fetchPatientMedications);
  const [drawer, setDrawer] = useState(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [openedAt] = useState(() => Date.now());

  useEffect(() => { if (patientId) fetchPatientMedications(patientId); }, [patientId, fetchPatientMedications]);

  if (!stored) return <DashboardCardSkeleton icon="solar:pill-linear" title="Medications" />;
  const { rows, counts } = medHighlights(stored, openedAt);
  const active = stored.filter(m => (m.status || 'Active') !== 'Stopped').length;
  const stopped = stored.length - active;
  const summary = MED_SUMMARY.filter(([k]) => counts[k]).map(([k, one, many]) => `${counts[k]} ${counts[k] === 1 ? one : many}`);

  return (
    <DashboardCard
      icon="solar:pill-linear"
      title="Medications"
      count={active || null}
      actions={(
        <CardHeaderActions insightsOpen={insightsOpen} onToggleInsights={() => setInsightsOpen(v => !v)}>
          <ActionButton size="sm" icon="solar:add-linear" tooltip="Add medication" tooltipLeft onClick={() => setDrawer('add')} />
        </CardHeaderActions>
      )}
    >
      <CardInsights open={insightsOpen} />
      <DashboardCardBody className={styles.listBody}>
        {rows.length === 0 ? (
          <p className={styles.empty}>No active medications on file.</p>
        ) : (
          <div className={styles.medTable}>
            <p className={styles.medSummary}>
              {summary.length ? `${summary.join(' • ')} in the last ${RECENT_DAYS} days` : `No changes in the last ${RECENT_DAYS} days`}
            </p>
            <div className={styles.medHead}>
              <span className={styles.medMain}>Name</span>
              <span className={styles.medStatus}>Status</span>
            </div>
            <CappedRows
              items={rows}
              limit={5}
              render={({ med: m, change, date }) => {
                const c = MED_CHANGE[change];
                const when = c ? c.meta(fmtDay(date)) : (m.start && `Start: ${formatClinicalDate(m.start)}`);
                const meta = [when, change === 'stopped' ? m.stopReason : m.sig].filter(Boolean).join(' • ');
                return (
                  <button key={m.id} type="button" className={styles.medRow} onClick={() => setDrawer(change === 'stopped' ? 'stopped' : 'add')}>
                    <span className={styles.medMain}>
                      <span className={styles.medName}>{m.name}</span>
                      {meta && <span className={styles.medMeta}>{meta}</span>}
                    </span>
                    <span className={styles.medStatus}>
                      {c ? <Badge tone={c.tone} size="sm" label={c.label} /> : <span className={styles.medMeta}>{m.status || 'Active'}</span>}
                    </span>
                  </button>
                );
              }}
            />
          </div>
        )}
        {stopped > 0 && (
          <div className={styles.medDiscontinued}>
            <Button variant="ghost" size="sm" trailingIcon="solar:alt-arrow-right-linear" onClick={() => setDrawer('stopped')}>
              Discontinued ({stopped})
            </Button>
          </div>
        )}
      </DashboardCardBody>
      {drawer && (
        <Suspense fallback={null}>
          <AddMedicationsDrawer patientId={patientId} focus={drawer === 'stopped' ? 'stopped' : undefined} onClose={() => setDrawer(null)} />
        </Suspense>
      )}
    </DashboardCard>
  );
}

export function ConditionsCard({ patientId, patient }) {
  const hccMembers = useAppStore(s => s.hccMembers);
  const fetchHccMembers = useAppStore(s => s.fetchHccMembers);
  const openDiagPanel = useAppStore(s => s.openDiagPanel);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const who = patient || { id: patientId };

  useEffect(() => { fetchHccMembers?.(); }, [fetchHccMembers]);

  const openDiagnosis = (text, code) => {
    const icd = (code && /^[A-Z]\d/.test(code) ? code : null) || icdFromText(text);
    const member = findWorklistMember(hccMembers, who);
    if (member && icd) {
      openDiagPanel(member.id, { highlightCode: icd });
      return;
    }
    setProblemsOpen(true);
  };

  return (
    <>
      <ProfileCard patientId={patientId} icon="solar:stethoscope-linear" title="Diagnoses & Problems" count={p => list(p.diagnoses).length || null} bodyClassName={styles.listBody}>
        {(p) => {
          const diagnoses = list(p.diagnoses);
          const chronic = list(p.chronic_conditions);
          const chronicSet = new Set(chronic);
          const problems = list(p.problems).filter(x => !chronicSet.has(x));
          const named = new Set(diagnoses.map((d) => {
            const [code, ...rest] = String(d).split(' ');
            return (/^[A-Z]\d/.test(code) ? rest.join(' ') : String(d)).toLowerCase();
          }));
          const extraChronic = chronic.filter(c => !named.has(String(c).toLowerCase()));
          const extraProblems = problems.filter(c => !named.has(String(c).toLowerCase()));
          if (!diagnoses.length && !extraChronic.length && !extraProblems.length) return <p className={styles.empty}>No diagnoses or problems on file.</p>;
          return (
            <>
              <CappedRows
                items={diagnoses}
                render={(d) => {
                  const [code, ...rest] = String(d).split(' ');
                  const isCode = /^[A-Z]\d/.test(code);
                  const title = isCode ? rest.join(' ') : d;
                  return (
                    <div key={d} className={styles.clickRow}>
                      <PanelSectionItem
                        inset
                        leading={isCode ? <span className={styles.codeChip}>{code}</span> : null}
                        title={(
                          <button type="button" className={`${styles.titleButton} ${styles.stretch}`} onClick={() => openDiagnosis(title, isCode ? code : null)}>
                            {title}
                          </button>
                        )}
                      />
                    </div>
                  );
                }}
              />
              {(extraChronic.length > 0 || extraProblems.length > 0) && (
                <div className={styles.chips}>
                  {extraChronic.map(c => (
                    <button key={c} type="button" className={styles.chipButton} onClick={() => openDiagnosis(c)}>
                      <Badge tone="warning" size="sm" label={c} />
                    </button>
                  ))}
                  {extraProblems.map(c => (
                    <button key={c} type="button" className={styles.chipButton} onClick={() => openDiagnosis(c)}>
                      <Badge size="sm" label={c} />
                    </button>
                  ))}
                </div>
              )}
            </>
          );
        }}
      </ProfileCard>
      {problemsOpen && (
        <Suspense fallback={null}>
          <AddProblemsDrawer patientId={patientId} onClose={() => setProblemsOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
