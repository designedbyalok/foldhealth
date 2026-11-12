import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { useLiveCall } from './useLiveCall';
import { acceptCopy, fillCm, itemState, speakerOf } from './liveCallModel';
import { dueDateOf, routeLabel } from './liveCallRouting';
import { jumpToLine } from './jumpToLine';
import styles from './LiveCallOverlay.module.css';

const RECORD_FIELDS = {
  task: r => [['Task', r.name], ['Due', dueDateOf(r).replaceAll('-', '/')], ['Priority', r.priority ? r.priority[0].toUpperCase() + r.priority.slice(1) : 'Medium']],
  appointment: r => [['Type', r.type], ['When', `${r.date.replaceAll('-', '/')} · ${r.start}${r.end ? ` to ${r.end}` : ''}`], ['With', r.provider || r.location || '-'], ['Mode', r.mode || 'At Clinic']],
  goal: r => [['Goal', r.title], ...(r.words ? [['In Their Words', `“${r.words}”`]] : [])],
  barrier: r => [['Barrier', r.title]],
  medication: r => [['Medication', r.rename || r.name], ['Change', { stop: 'Stop', update: 'Update', add: 'Add to the list' }[r.action] || r.action], ...(r.sig ? [['Sig', r.sig]] : []), ...(r.reason ? [['Reason', r.reason]] : [])],
};

/** Right rail: one action item in full, and exactly what accepting it creates at wrap-up. */
export function ItemDetails({ script, item, cmName, showToast }) {
  const session = useLiveCall();
  const st = itemState(session, item.id);
  const copy = acceptCopy(item);
  const title = session.edits[item.id] || item.title;
  const lineIdx = script.lines.findIndex(l => l.item === item.id);
  const line = script.lines[lineIdx];
  const who = line ? speakerOf(script, line.who, cmName) : null;
  const record = item.route ? RECORD_FIELDS[item.route.kind]?.(item.route) : null;

  return (
    <div className={styles.medEditor}>
      <div className={styles.itemsHead}>
        <div className={styles.itemsTitleRow}>
          <Button variant="ghost" size="sm" leadingIcon="solar:arrow-left-linear" onClick={session.closeDetail}>Action Items</Button>
          <span className={styles.spacer} />
          <span className={styles.count}>To {item.where}</span>
        </div>
      </div>

      <div className={styles.medBody}>
        <div className={styles.medHead}>
          <span><Badge size="sm" tone={item.tone} icon={item.icon} label={item.type} /></span>
          <span className={styles.medTitle}>{title}</span>
        </div>

        <section className={styles.briefSection}>
          <span className={styles.sectionLabel}>Details</span>
          <div className={styles.fields}>
            {[...(item.src ? [['Source', `${item.src[0]} · ${item.src[1]}`]] : []), ...item.fields].map(([k, v]) => (
              <span key={k} className={styles.field}><span className={styles.fieldKey}>{k}</span><span>{fillCm(v, cmName)}</span></span>
            ))}
          </div>
        </section>

        <section className={styles.briefSection}>
          <span className={styles.sectionLabel}>At Wrap-Up</span>
          <span className={styles.medSig}>{routeLabel(item.route)}{item.route ? '' : '. Nothing else is created.'}</span>
          {record && (
            <div className={styles.fields}>
              {record.map(([k, v]) => <span key={k} className={styles.field}><span className={styles.fieldKey}>{k}</span><span>{v}</span></span>)}
            </div>
          )}
        </section>

        {line && (
          <section className={styles.briefSection}>
            <span className={styles.sectionLabel}>Heard on the Call</span>
            <button type="button" className={styles.quote} onClick={() => jumpToLine(lineIdx)} title="Jump to this moment in the transcript">
              <Icon name="solar:chat-round-dots-linear" size={14} color="var(--neutral-300)" />
              <span>“{fillCm(line.text, cmName)}” <span className={styles.quoteBy}>{who.name.split(' ')[0]} · {line.t}</span></span>
            </button>
          </section>
        )}

        <div className={styles.itemActions}>
          {st === 'pending' && (
            <>
              <Button size="sm" onClick={() => { session.accept(item.id); showToast(`${item.type} accepted · saves at wrap-up`); }}>{copy.label}</Button>
              <Button size="sm" variant="outline" onClick={() => { session.closeDetail(); session.startEdit(item.id, title); }}>Edit</Button>
              <span className={styles.spacer} />
              <Button size="sm" variant="ghost" onClick={() => { session.dismiss(item.id); session.closeDetail(); }}>Dismiss</Button>
            </>
          )}
          {st === 'accepted' && (
            <>
              <Icon name="solar:check-circle-linear" size={16} color="var(--status-success)" />
              <span className={styles.acceptedText}>{copy.done}</span>
              <Button size="sm" variant="ghost" onClick={() => session.undo(item.id)}>Undo</Button>
            </>
          )}
          {st === 'dismissed' && <span className={styles.acceptedText}>Dismissed</span>}
        </div>
      </div>
    </div>
  );
}
