import { Icon } from '../../components/Icon/Icon';
import { Avatar } from '../../components/Avatar/Avatar';
import { Badge } from '../../components/Badge/Badge';
import { Checkbox } from '../../components/ui/checkbox';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { useAppStore } from '../../store/useAppStore';
import styles from './HedisWorklistRow.module.css';

const LANG_MAP = {
  en: 'English', es: 'Spanish; Castilian', zh: 'Chinese', yue: 'Cantonese',
  ko: 'Korean', vi: 'Vietnamese', hi: 'Hindi', bn: 'Bengali', ar: 'Arabic',
};

// HEDIS risk level → existing Badge variant.
const RISK_BADGE_VARIANT = {
  '1_High':     'priority-critical',
  '2_Mod-High': 'priority-high',
  '3_Moderate': 'priority-medium',
  '4_Mod-Low':  'toc-engaged',
  '5_Low':      'compliance-pass',
};

const STATUS_CLASS = { Open: styles.gapStatusOpen, Closed: styles.gapStatusClosed, Excluded: styles.gapStatusExcluded };

// Outreach cell — mirrors the TOC worklist's outreach pattern
// (src/features/toc-worklist/WorklistRow.jsx OutreachCell).
function OutreachCell({ member }) {
  // `||` alone isn't enough: a non-array truthy value (e.g. a Supabase JSONB
  // object that wasn't normalised to an array) would slip through and crash
  // `.map` below. Use Array.isArray so only real arrays get through.
  const dots = Array.isArray(member.outreachDots)
    ? member.outreachDots
    : ['pending', 'pending', 'pending'];
  const hasSuccess = dots.includes('success');
  const hasFailed = dots.includes('failed') && !hasSuccess;

  return (
    <div className={styles.outreachWl}>
      <div className={styles.outreachWlMain}>
        {hasSuccess ? (
          <>
            <Icon name="solar:phone-calling-bold" size={15} color="#059669" />
            <div>
              <div className={styles.outreachWlText}>Attended</div>
              {member.outreachDate && (
                <div className={styles.outreachWlDate}>{member.outreachDate}</div>
              )}
            </div>
          </>
        ) : hasFailed ? (
          <>
            <Icon name="solar:phone-bold" size={15} color="#DC2626" />
            <div>
              <div className={styles.outreachWlFailed}>Failed</div>
              {member.outreachDate && (
                <div className={styles.outreachWlDateMuted}>{member.outreachDate}</div>
              )}
            </div>
          </>
        ) : (
          <>
            <Icon name="solar:phone-linear" size={15} color="var(--neutral-200)" />
            <div className={styles.outreachWlNone}>—</div>
          </>
        )}
      </div>
      <div className={styles.dotsRow}>
        {dots.map((d, i) => <div key={i} className={`${styles.dot} ${styles[d]}`} />)}
      </div>
    </div>
  );
}

export function HedisWorklistRow({ member, isSelected, onSelect, onOpenGap }) {
  const showToast = useAppStore(s => s.showToast);
  const openQuickView = useAppStore(s => s.openQuickView);
  const gaps = Array.isArray(member.gaps) ? member.gaps : [];
  // No usable gaps → skip the row entirely. Without this, `primaryGap` below
  // would be undefined and the row's click handlers would throw on access.
  if (gaps.length === 0) return null;
  const primaryGap = gaps[0];
  // Single-gap members center their lone item; multi-gap stays top-aligned.
  const tdGap = gaps.length === 1
    ? `${styles.tdGap} ${styles.tdGapCenter}`
    : styles.tdGap;

  const langShort = (member.language || 'en').toUpperCase();
  const langFull = LANG_MAP[member.language] || member.language;

  return (
    <tr
      className={[styles.row, isSelected ? styles.rowChecked : ''].filter(Boolean).join(' ')}
      onClick={() => onOpenGap?.(member, primaryGap.code)}
    >
      {/* Checkbox */}
      <td className={`${styles.checkTd} ${styles.stickyLeft} ${styles.stickyCheck}`} onClick={e => e.stopPropagation()}>
        <Checkbox checked={isSelected} onCheckedChange={() => onSelect(member.id)} aria-label={`Select ${member.name}`} />
      </td>

      {/* Member — matches src/features/toc-worklist member-cell pattern */}
      <td className={`${styles.memberTd} ${styles.stickyLeft} ${styles.stickyMember}`}>
        <div className={styles.patientCell}>
          <Avatar variant="patient" initials={member.in} />
          <div>
            <div className={styles.patientName}>
              <button
                className={styles.patientNameLink}
                onClick={e => {
                  e.stopPropagation();
                  openQuickView({ id: member.id, name: member.name, initials: member.in, gender: member.gender, age: member.age, memberId: member.memberId, language: member.language });
                }}
              >
                {member.name}
              </button>{' '}
              <span className={styles.patientDemo}>({member.gender}&bull;{member.age})</span>
            </div>
            <div className={styles.patientMeta}>
              {member.memberId} &bull;{' '}
              <span className={styles.langBadge}>
                {langShort}
                <span className={styles.langTooltip}>Preferred Language: {langFull}</span>
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Total Gaps — one badge per gap, aligned with sibling gap cells */}
      <td className={tdGap} onClick={e => e.stopPropagation()}>
        <div className={styles.gapItems}>
          {gaps.map(g => (
            <div key={g.code} className={styles.gapItem}>
              <span onClick={() => onOpenGap?.(member, g.code)} style={{ cursor: 'pointer' }}>
                <Badge variant="compliance-na" label={g.code} />
              </span>
            </div>
          ))}
        </div>
      </td>

      {/* Gap Status — one per gap */}
      <td className={tdGap}>
        <div className={styles.gapItems}>
          {gaps.map(g => (
            <div key={g.code} className={styles.gapItem}>
              <span className={STATUS_CLASS[g.status] || ''}>{g.status}</span>
            </div>
          ))}
        </div>
      </td>

      {/* Assignee — per gap, falls back to member-level assignee */}
      <td className={tdGap} onClick={e => e.stopPropagation()}>
        <div className={styles.gapItems}>
          {gaps.map(g => {
            const assignee = g.assignee ?? member.assignee;
            return (
              <div key={g.code} className={styles.gapItem}>
                {assignee ? (
                  <div className={styles.assigneeName}>
                    <Icon name="solar:user-linear" size={14} color="var(--neutral-400)" />
                    <span>{assignee}</span>
                  </div>
                ) : (
                  <button
                    className={styles.assigneeBtn}
                    onClick={() => showToast('Assign care manager — coming soon')}
                  >
                    <Icon name="solar:user-linear" size={14} color="var(--neutral-200)" />
                    Assign
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </td>

      {/* Start Date — per gap, right border divides per-gap from per-member columns */}
      <td className={`${tdGap} ${styles.tdGapDivide}`}>
        <div className={styles.gapItems}>
          {gaps.map(g => (
            <div key={g.code} className={styles.gapItem}>
              <span className={styles.startDateValue}>{g.startDate ?? member.startDate}</span>
            </div>
          ))}
        </div>
      </td>

      {/* Outreach — per member */}
      <td className={styles.td}>
        <OutreachCell member={member} />
      </td>

      {/* AdvIllness */}
      <td className={styles.td}>
        <span className={styles.numText}>{member.advIllness ?? 0}</span>
      </td>

      {/* Frailty */}
      <td className={styles.td}>
        <span className={styles.numText}>{member.frailty ?? 0}</span>
      </td>

      {/* Risk Level — uses shared <Badge> with risk variants */}
      <td className={styles.td}>
        {member.riskLevel ? (
          <Badge variant={RISK_BADGE_VARIANT[member.riskLevel]} label={member.riskLevel} />
        ) : (
          <span className={styles.muted}>—</span>
        )}
      </td>

      {/* Tasks */}
      <td className={styles.td}>
        {member.tasks != null
          ? <span className={styles.numText}>{member.tasks}</span>
          : <span className={styles.muted}>—</span>}
      </td>

      {/* Actions */}
      <td className={`${styles.actionsCell} ${styles.stickyRight}`}>
        <div className={styles.actionsBtns}>
          <ActionButton
            icon="solar:eye-linear"
            size="L"
            tooltip="View care gap details"
            onClick={e => { e.stopPropagation(); onOpenGap?.(member, primaryGap.code); }}
          />
          <span className={styles.actionsDivider} />
          <ActionButton
            icon="solar:phone-linear"
            size="L"
            tooltip="Call"
            onClick={e => { e.stopPropagation(); showToast('Call — coming soon'); }}
          />
          <span className={styles.actionsDivider} />
          <ActionButton
            icon="solar:menu-dots-bold"
            size="L"
            tooltip="More"
            onClick={e => { e.stopPropagation(); showToast('More actions — coming soon'); }}
          />
        </div>
      </td>
    </tr>
  );
}
