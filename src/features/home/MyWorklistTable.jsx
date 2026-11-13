import { useRef, useState } from 'react';
import { WorklistShell } from '../../components/WorklistShell/WorklistShell';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { FoldIdTag } from '../../components/FoldIdTag/FoldIdTag';
import { Icon } from '../../components/Icon/Icon';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { OutreachStatus } from '../../components/OutreachStatus/OutreachStatus';
import { outreachFromDots } from '../../components/OutreachStatus/outreachStatusModel';
import { PatientAvatarHover } from '../../components/PatientHoverCard/PatientAvatarHover';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { useAppStore } from '../../store/useAppStore';
import { Avatar } from '../../components/Avatar/Avatar';
import { initialsOf } from '../ooo/oooUtils';
import styles from './MyWorklistTable.module.css';

const COLUMNS = [
  { key: 'members', label: 'Members', sticky: 'left', left: 0, width: 350 },
  { key: 'programs', label: 'Active Program | Open Gaps', width: 220 },
  { key: 'nextAction', label: 'Next Action Due', width: 130 },
  { key: 'outreach', label: 'Last Outreach', width: 140 },
  { key: 'assignee', label: 'Assignee', width: 170 },
  { key: 'actions', label: 'Actions', sticky: 'right', width: 170 },
];
const MAX_PILLS = 5;
const LANGUAGES = { en: 'English', es: 'Spanish', vi: 'Vietnamese', zh: 'Chinese', ko: 'Korean', hi: 'Hindi', fr: 'French' };
const mdY = (ms) => {
  const d = new Date(ms);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};
const ageShort = (age) => (age ? String(age).replace(/\s+/g, ' ') : '');

function Row({ row, facts, meName, onOpen, onOpenTask }) {
  const openCallPopover = useAppStore(s => s.openCallPopover);
  const showToast = useAppStore(s => s.showToast);
  const callRef = useRef(null);
  const [menu, setMenu] = useState(null); // anchor rect
  const lang = facts.langCode || '';
  const pills = facts.programs || [];
  return (
    <tr className={styles.row}>
      <td className={`${styles.membersTd} ${styles.stickyLeft}`} style={{ left: 0 }}>
        <div className={styles.patientCell}>
          <PatientAvatarHover patient={{ id: facts.patientId, memberId: facts.memberId, name: row.name, initials: row.initials, gender: row.gender, age: row.age, dob: row.dob }} />
          <div className={styles.memberText}>
            <div className={styles.patientName}>
              <button type="button" className={styles.patientNameLink} onClick={() => onOpen(row)}>{row.name}</button>{' '}
              <span className={styles.patientDemo}>({row.gender || '-'} • {ageShort(row.age)})</span>
            </div>
            <div className={styles.patientMeta}>
              {facts.memberId && <FoldIdTag id={facts.memberId} className={styles.foldId} showToast={showToast} />}
              {facts.memberId && lang && ' • '}
              {lang && (
                <Tooltip label={`Preferred Language: ${LANGUAGES[lang] || lang.toUpperCase()}`} variant="light">
                  <span className={styles.langBadge}>{lang.charAt(0).toUpperCase() + lang.slice(1)}</span>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className={styles.td}>
        <span className={styles.pills}>
          {pills.slice(0, MAX_PILLS).map(p => <Badge key={p} size="sm" tone="neutral" label={p} />)}
          {pills.length > MAX_PILLS && (
            <Tooltip label={pills.slice(MAX_PILLS).join(', ')}>
              <span className={styles.more}>+{pills.length - MAX_PILLS}</span>
            </Tooltip>
          )}
          {!pills.length && '-'}
        </span>
      </td>
      <td className={styles.td}>{facts.nextAction != null ? mdY(facts.nextAction) : '-'}</td>
      <td className={styles.td}>
        <OutreachStatus {...outreachFromDots(facts.outreach?.dots, { date: facts.outreach?.date, attended: facts.outreach?.attended })} />
      </td>
      <td className={styles.td}>
        {/* Covered patients show who's out (their avatar's badge, "You're
            covering" on hover); the rest are mine. */}
        {(() => {
          const who = row.coveringFor?.[0]?.name || meName;
          return who ? (
            <span className={styles.assignee}>
              <Avatar variant="assignee" size="S" initials={initialsOf(who)} userName={who} />
              <span className={styles.assigneeName}>{who}</span>
            </span>
          ) : '-';
        })()}
      </td>
      <td className={`${styles.td} ${styles.stickyRight}`}>
        <span className={styles.actionsCell}>
          <Button variant="outline" size="sm" leadingIcon="solar:eye-linear" onClick={() => onOpen(row)}>View</Button>
          <span className={styles.actionDivider} aria-hidden="true" />
          <ActionButton
            ref={callRef}
            icon="solar:phone-linear"
            tooltip="Call patient"
            tooltipLeft
            onClick={(e) => { e.stopPropagation(); openCallPopover(facts.patientId || row.id, callRef); }}
          />
          <span className={styles.actionDivider} aria-hidden="true" />
          <ActionButton
            icon="solar:menu-dots-linear"
            tooltip="More Options"
            tooltipLeft
            aria-label="More options"
            onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}
          />
        </span>
        {menu && (
          <MenuPopover
            anchorRect={menu}
            align="right"
            items={[{ key: 'tasks', label: row.myTaskCount ? `View Tasks (${row.myTaskCount})` : 'View Tasks', icon: 'solar:checklist-minimalistic-linear', disabled: !row.myTaskCount }]}
            onSelect={() => { onOpenTask(row); setMenu(null); }}
            onClose={() => setMenu(null)}
          />
        )}
      </td>
    </tr>
  );
}

/**
 * My Worklist (Home) as a worklist table (Figma My Worklist 5028:58501):
 * Members (name, gender and age, Fold ID and language, any "Covering for"),
 * Active Program | Open Gaps (the worklists they're on), Next Action Due (next
 * appointment or open task), Last Outreach, Assignee (whoever's out, for a
 * patient I'm covering), and View / Call / More.
 *
 * @param {Array<{ row, facts }>} props.items – rows with their facts (worklistFilters.rowFacts)
 * @param {string}  props.meName – The signed-in user, the Assignee of my own patients
 * @param {boolean} props.loading
 * @param {React.ReactNode} props.emptyState
 * @param {function} props.onOpen     – (row) => open the patient quick view
 * @param {function} props.onOpenTask – (row) => open one of my tasks for them
 */
export function MyWorklistTable({ items, meName, loading, emptyState, onOpen, onOpenTask }) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const last = Math.max(1, Math.ceil(items.length / perPage));
  const pageNow = Math.min(page, last);
  const shown = items.slice((pageNow - 1) * perPage, pageNow * perPage);
  return (
    <div className={styles.wrap}>
      <WorklistShell
        header={null}
        columns={COLUMNS}
        rows={shown}
        renderRow={({ row, facts }) => <Row key={row.key} row={row} facts={facts} meName={meName} onOpen={onOpen} onOpenTask={onOpenTask} />}
        loading={loading}
        emptyState={emptyState}
        minTableWidth={1180}
        fixedLayout
        page={pageNow}
        perPage={perPage}
        totalItems={items.length}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPerPage(n); setPage(1); }}
      />
    </div>
  );
}
