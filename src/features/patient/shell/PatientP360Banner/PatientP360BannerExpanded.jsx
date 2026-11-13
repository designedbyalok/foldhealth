import { useState } from 'react';
import { Avatar } from '../../../../components/Avatar/Avatar';
import { Icon } from '../../../../components/Icon/Icon';
import { Tooltip } from '../../../../components/Tooltip/Tooltip';
import { Badge } from '../../../../components/Badge/Badge';
import { Link } from '../../../../components/Link/Link';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { AddIconMinimalist } from '../../../../components/Icon/AddIconMinimalist';
import { Banner } from '../../../../components/Banner/Banner';
import { EmptyState } from '../../../../components/EmptyState/EmptyState';
import { MenuPopover } from '../../../../components/MenuPopover/MenuPopover';
import { usePatientFamily } from '../../family/usePatientFamily';
import { usePatientCareTeam } from '../../care-team/usePatientCareTeam';
import { Skeleton } from '../../../../components/Skeleton/Skeleton';
import styles from './PatientP360Banner.module.css';

// Enrolled care-program badges: first MAX_VISIBLE codes, then a "+N"
// overflow whose hover popover lists the rest (one program per line).
// `codes` comes from the real patient_care_programs enrollment (deduped in
// PatientP360Banner), so every patient shows their true programs; none
// enrolled renders '-'.
const MAX_VISIBLE_PROGRAMS = 2;
export function ProgramBadgeList({ codes, badgeClass, overflowClass }) {
  if (!codes?.length) return <span className={styles.expandLabel}>-</span>;
  const visible = codes.slice(0, MAX_VISIBLE_PROGRAMS);
  const overflow = codes.slice(MAX_VISIBLE_PROGRAMS);
  return (
    <>
      {visible.map(code => <span key={code} className={badgeClass}>{code}</span>)}
      {overflow.length > 0 && (
        <Tooltip
          placement="bottom"
          label={overflow.map(code => <div key={code}>{code}</div>)}
        >
          <span className={overflowClass}>+{overflow.length}</span>
        </Tooltip>
      )}
    </>
  );
}

// Values with a grey dot between them, e.g. "(626) 555-0182 • (415) 555-0145".
function Joined({ items }) {
  return items.map((v, i) => (
    <span key={v} className={styles.infoValue}>{i > 0 && <span className={styles.infoSep}>•</span>}{v}</span>
  ));
}

function More({ count }) {
  return count > 0 ? <Badge size="xs" label={`+${count}`} /> : null;
}

function InfoRow({ icon, label, children }) {
  return (
    <div className={styles.infoRow}>
      <Icon name={icon} size={16} color="var(--neutral-300)" className={styles.infoIcon} />
      <div className={styles.infoBody}>
        {label && <span className={styles.infoLabel}>{label}</span>}
        <span className={styles.infoLine}>{children}</span>
      </div>
    </div>
  );
}

// Patient Demographic Details (Figma P360 Revamp 2880:369078).
export function ExpandedDemographics({ p, className }) {
  const emails = p.emails || [];
  const primary = p.plan_numbers_primary || [];
  const secondary = p.plan_numbers_secondary || [];
  return (
    <div className={className ?? styles.expandCol}>
      <div className={styles.infoSection}>
        <h4 className={styles.expandTitle}>Patient Demographic Details</h4>
        <div className={styles.infoList}>
          <InfoRow icon="solar:map-point-linear">{p.location || '-'}<More count={p.location_count} /></InfoRow>
          <InfoRow icon="solar:translation-2-linear"><Joined items={p.languages?.length ? p.languages : ['-']} /></InfoRow>
          <InfoRow icon="solar:letter-linear">{emails[0] || '-'}<More count={emails.length - 1} /></InfoRow>
          <InfoRow icon="solar:phone-linear" label="Plan Numbers (Primary)"><Joined items={primary.length ? primary : ['-']} /></InfoRow>
          <InfoRow icon="solar:phone-linear" label="Secondary Numbers"><Joined items={secondary.length ? secondary : ['-']} /></InfoRow>
        </div>
      </div>
    </div>
  );
}

export function ExpandedHealthStatus({ p, className, movedMetrics = false, programCodes }) {
  const v = p.recent_vitals || {};
  return (
    <div className={className ?? styles.expandCol}>
      <div className={styles.infoSection}>
      <h4 className={styles.expandTitle}>Health Status</h4>
      <div className={styles.healthList}>
        {/* Responsive: Programs + Last Contact relocate here from the banner
            row once it's too narrow to hold them. */}
        {movedMetrics && (
          <>
            <div className={styles.healthItem}>
              <span className={styles.infoLabel}>Programs</span>
              <div className={styles.conditionBadges}>
                <ProgramBadgeList
                  codes={programCodes}
                  badgeClass={styles.conditionBadge}
                  overflowClass={styles.conditionBadgeGrey}
                />
              </div>
            </div>
            <div className={styles.healthItem}>
              <span className={styles.infoLabel}>Last Contact</span>
              <div className={styles.lastContactBtn}>
                <Icon name="solar:phone-calling-linear" size={16} color="var(--status-error)" />
                <span className={styles.lastContactText}>{p.last_contact_type}({p.last_contact_days}d)</span>
              </div>
            </div>
          </>
        )}
        <div className={styles.healthItem}>
          <span className={styles.infoLabel}>Chronic Condition</span>
          <div className={styles.conditionBadges}>{(p.chronic_conditions || []).map(c => <span key={c} className={styles.conditionBadge}>{c}</span>)}</div>
        </div>
        <div className={styles.healthItem}>
          <span className={styles.infoLabel}>Recent Vitals ({v.date || '-'})</span>
          <div className={`${styles.vitalsGrid} ${styles.healthValue}`}><span>BP: {v.bp || '-'}</span><span>Weight: {v.weight || '-'}</span><span>Pulse: {v.pulse || '-'}</span><span>HbA1c: {v.hba1c || '-'}</span></div>
        </div>
        <div className={styles.healthItem}>
          <span className={styles.infoLabel}>Opted out of (Communication)</span>
          <span className={styles.healthValue}>{(p.opted_out_comms || []).join(' • ') || 'None'}</span>
        </div>
      </div>
      </div>
    </div>
  );
}

export function ExpandedAppointments({ p, className }) {
  return (
    <div className={className ?? styles.expandCol}>
      <h4 className={styles.expandTitle}>Upcoming Appointments</h4>
      <div className={styles.expandRows}>
        {(p.upcoming_appointments || []).map((a, i) => (
          <div key={i} className={styles.apptRow}>
            <Icon name={i === 0 ? 'solar:clipboard-text-linear' : 'solar:calendar-linear'} size={14} color="var(--primary-300)" />
            <div className={styles.apptInfo}><span className={styles.apptType}>{a.type}</span><span className={styles.apptMeta}>{a.date}{a.time ? `, ${a.time}` : ''} • {a.program} • & {a.provider}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Family and Caregiver / Care Team (Figma P360 Revamp 2880:369202).
function PersonRow({ initials, variant, name, tag, sub }) {
  return (
    <div className={styles.personRow}>
      <Avatar variant={variant} size="S" initials={initials} />
      <div className={styles.personText}>
        <span className={styles.personName}>{name}{tag && <Badge size="xs" label={tag} />}</span>
        <span className={styles.personRole}>{sub}</span>
      </div>
    </div>
  );
}

function ViewAll({ onClick }) {
  return (
    <Link className={styles.viewAll} role="button" tabIndex={0} onClick={onClick}>
      View All
      <Icon name="solar:alt-arrow-right-linear" size={12} color="currentColor" />
    </Link>
  );
}

// A person row's shape while family loads.
function PersonRowSkeleton() {
  return (
    <div className={styles.personRow} aria-hidden="true">
      <Skeleton className={styles.boneAvatar} />
      <span className={styles.personText}>
        <Skeleton className={styles.boneName} />
        <Skeleton className={styles.boneSub} />
      </span>
    </div>
  );
}

// `onManage` opens Add Family, Caregivers & Decision Makers; `onManageCareTeam`
// the Primary Care Team drawer. Family loads only while `visible` (the
// banner is expanded), with a loader until it arrives.
export function ExpandedFamily({ p, patientId, visible = true, className, profiles = [], activeProfileId = 'central', onManage, onManageCareTeam }) {
  const { family, familyOf, loading } = usePatientFamily(patientId, p.family_members, visible);
  // Which location's care team to show. From the Central Profile any
  // location can be picked here; with a location picked at the top of the
  // banner, it's that one.
  const [pickedLocation, setPickedLocation] = useState('central');
  const [locationMenu, setLocationMenu] = useState(null);
  const canPickLocation = activeProfileId === 'central';
  const location = canPickLocation ? pickedLocation : activeProfileId;
  const locationName = profiles.find(pr => pr.id === location)?.name || p.care_team_profile_type || 'Central Profile';
  // The care team loads the same way, from patient_care_team.
  const { team, loading: teamLoading } = usePatientCareTeam(patientId, visible, location);
  return (
    <div className={className ?? styles.expandCol}>
      <div className={styles.peopleStack}>
        <section className={styles.peopleSection}>
          <div className={styles.sectionHead}>
            <h4 className={styles.expandTitle}>Family and Caregiver</h4>
            {/* Settles on + or the pencil once family has loaded, so it doesn't flip. */}
            {!loading && (family.length > 0
              ? <ActionButton icon="solar:pen-2-linear" size="sm" tooltip="Edit family and caregivers" onClick={onManage} />
              : <ActionButton size="sm" tooltip="Add family and caregivers" onClick={onManage}><AddIconMinimalist size={16} color="var(--neutral-300)" /></ActionButton>)}
          </div>
          {familyOf > 0 && (
            <Banner size="sm">
              Member is identified as family & caregiver for <Link className={styles.noticeLink}>{familyOf} Members</Link>
            </Banner>
          )}
          {loading ? (
            <div className={styles.people}><PersonRowSkeleton /><PersonRowSkeleton /></div>
          ) : family.length > 0 ? (
            <>
              <div className={styles.people}>
                {family.map((m, i) => <PersonRow key={i} variant="patient" initials={m.initials} name={m.name} sub={m.relation} />)}
              </div>
              <ViewAll onClick={onManage} />
            </>
          ) : (
            // Figma P360 Revamp 6111:268485.
            <div className={styles.familyEmpty}>
              <EmptyState size="sm" icon="solar:user-heart-linear" title="No Family Added" />
            </div>
          )}
        </section>
        <section className={styles.peopleSection}>
          <div className={styles.sectionHead}>
            <h4 className={`${styles.expandTitle} ${styles.sectionTitleGrow}`}>Care Team</h4>
            {canPickLocation && profiles.length > 1 ? (
              <Link
                variant="secondary"
                className={styles.profileType}
                role="button"
                tabIndex={0}
                aria-haspopup="menu"
                aria-label={`Care team location: ${locationName}`}
                onClick={e => setLocationMenu(e.currentTarget.getBoundingClientRect())}
              >
                {locationName}
                <Icon name="solar:alt-arrow-down-linear" size={12} color="currentColor" />
              </Link>
            ) : (
              <span className={styles.profileTypeStatic}>{locationName}</span>
            )}
            <span className={styles.headDivider} />
            {!teamLoading && (team.length > 0
              ? <ActionButton icon="solar:pen-2-linear" size="sm" tooltip="Edit care team" onClick={() => onManageCareTeam(location)} />
              : <ActionButton size="sm" tooltip="Add care team members" onClick={() => onManageCareTeam(location)}><AddIconMinimalist size={16} color="var(--neutral-300)" /></ActionButton>)}
          </div>
          {teamLoading ? (
            <div className={styles.people}><PersonRowSkeleton /><PersonRowSkeleton /></div>
          ) : team.length > 0 ? (
            <>
              <div className={styles.people}>
                {team.map((m, i) => <PersonRow key={i} variant="staff" initials={m.initials} name={m.name} tag={m.role} sub={m.title} />)}
              </div>
              <ViewAll onClick={() => onManageCareTeam(location)} />
            </>
          ) : (
            <div className={styles.familyEmpty}>
              <EmptyState size="sm" icon="solar:users-group-rounded-linear" title="No Care Team Added" />
            </div>
          )}
          {locationMenu && (
            <MenuPopover
              anchorRect={locationMenu}
              ariaLabel="Care team location"
              width="auto"
              items={profiles.map(pr => ({ key: pr.id, label: pr.name, selected: pr.id === location }))}
              onSelect={(key) => { setPickedLocation(key); setLocationMenu(null); }}
              onClose={() => setLocationMenu(null)}
            />
          )}
        </section>
      </div>
    </div>
  );
}

/* Quick-view-style expanded panel: a metrics strip over a 2-column layout.
   Shared by the drawer variant AND the full banner's responsive expansion so
   both surface the same detail view. */
export function QuickViewExpanded({ p, patientId, visible = true, programCodes, profiles, activeProfileId, onManageFamily, onManageCareTeam }) {
  return (
    <div className={styles.drawerExpandedPanel}>
      {/* A grid, not a flex row: one row when wide, two (3 + 2) when narrow,
          three when very narrow. Hairlines come from the grid gap. */}
      <div className={styles.drawerMetricsStrip}>
        <div className={`${styles.drawerMetricItem} ${styles.drawerMetricTop}`}>
          <span className={styles.drawerMetricLabel}>Acuity</span>
          <span className={`${styles.badge} ${styles.badgeError}`}>{p.acuity}</span>
        </div>
        <div className={`${styles.drawerMetricItem} ${styles.drawerMetricTop}`}>
          <span className={styles.drawerMetricLabel}>RAF</span>
          <div className={`${styles.metricValueRow} ${styles.drawerMetricValues}`}>
            <span className={styles.rafValue}>{p.raf_score}</span>
            {p.raf_change > 0 && <span className={styles.rafChangeBadge}>+{p.raf_change} <Icon name="solar:arrow-up-linear" size={12} color="var(--status-error)" /></span>}
          </div>
        </div>
        <div className={`${styles.drawerMetricItem} ${styles.drawerMetricTop}`}>
          <span className={styles.drawerMetricLabel}>Next Appt.</span>
          <span className={styles.nextApptValue}>{p.next_appointment_date || '-'}</span>
        </div>
        <div className={`${styles.drawerMetricItem} ${styles.drawerMetricBottom}`}>
          <span className={styles.drawerMetricLabel}>Last Contact</span>
          <div className={styles.lastContactBtn}>
            <Icon name="solar:phone-calling-linear" size={16} color="var(--status-error)" />
            <span className={styles.lastContactText}>{p.last_contact_type}({p.last_contact_days}d)</span>
          </div>
        </div>
        <div className={`${styles.drawerMetricItem} ${styles.drawerMetricBottom}`}>
          <span className={styles.drawerMetricLabel}>Programs</span>
          <div className={`${styles.programBadges} ${styles.drawerMetricValues}`}>
            <ProgramBadgeList
              codes={programCodes}
              badgeClass={`${styles.badge} ${styles.badgeInfo}`}
              overflowClass={`${styles.badge} ${styles.badgeGrey}`}
            />
          </div>
        </div>
      </div>
      <div className={styles.drawerExpandedCols}>
        <div className={styles.drawerExpandedCol}>
          <ExpandedDemographics p={p} className={styles.drawerExpandedSection} />
          <ExpandedFamily p={p} patientId={patientId} visible={visible} className={styles.drawerExpandedSection} profiles={profiles} activeProfileId={activeProfileId} onManage={onManageFamily} onManageCareTeam={onManageCareTeam} />
        </div>
        <span className={styles.drawerExpandedColDivider} aria-hidden="true" />
        <div className={styles.drawerExpandedCol}>
          <ExpandedHealthStatus p={p} className={styles.drawerExpandedSection} />
          <ExpandedAppointments p={p} className={styles.drawerExpandedSection} />
        </div>
      </div>
    </div>
  );
}