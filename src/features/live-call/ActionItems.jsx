import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { Input } from '../../components/Input/Input';
import { SegmentedControl } from '../../components/SegmentedControl/SegmentedControl';
import { useLiveCall } from './useLiveCall';
import { MedicationEditor } from './MedicationEditor';
import { ItemDetails } from './ItemDetails';
import { acceptCopy, actionItemsView, fillCm, itemState, speakerOf } from './liveCallModel';
import styles from './LiveCallOverlay.module.css';

/** Right rail: tasks, appointments, goals, barriers and medication changes heard on the call. */
export function ActionItems({ script, cmName, showToast }) {
  const session = useLiveCall();
  const openMed = session.medOpen ? script.meds.find(m => m.n === session.medOpen) : null;
  const detailItem = session.detailId ? script.items.find(it => it.id === session.detailId) : null;
  const view = actionItemsView(script, session.consent === 'yes' ? session.shown : 0, session);
  const filters = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: `Pending (${view.pendingN})` },
    { key: 'accepted', label: `Accepted (${view.acceptedN})` },
  ];
  const acceptAll = () => {
    session.acceptMany(view.bulk.map(it => it.id));
    const left = view.pendingN - view.bulk.length;
    showToast(`${view.bulk.length} items accepted · save at wrap-up${left ? ` · ${left} medication ${left === 1 ? 'change needs' : 'changes need'} review one at a time` : ''}`);
  };

  if (openMed) {
    return (
      <aside className={styles.panel} aria-label="Medication">
        <MedicationEditor key={openMed.n} script={script} med={openMed} cmName={cmName} showToast={showToast} />
      </aside>
    );
  }

  if (detailItem) {
    return (
      <aside className={styles.panel} aria-label="Action item">
        <ItemDetails key={detailItem.id} script={script} item={detailItem} cmName={cmName} showToast={showToast} />
      </aside>
    );
  }

  return (
    <aside className={styles.panel} aria-label="Action items">
      <div className={styles.itemsHead}>
        <div className={styles.itemsTitleRow}>
          <Icon name="custom:ai" size={16} />
          <span className={styles.panelTitle}>Action Items</span>
          <span className={styles.count}>{view.raised.length} found · {view.acceptedN} accepted</span>
        </div>
        <div className={styles.itemsTools}>
          <SegmentedControl size="sm" items={filters} value={session.filter} onValueChange={session.setFilter} aria-label="Filter action items" />
          <span className={styles.spacer} />
          {view.bulk.length > 0 && (
            <Button variant="soft" size="sm" onClick={acceptAll} title="Medication changes are reviewed one at a time">Accept All</Button>
          )}
        </div>
      </div>

      <div className={styles.itemList}>
        {view.visible.length === 0 && (
          <div className={styles.itemsEmpty}>
            {view.raised.length === 0 ? 'Listening for tasks, appointments, goals, barriers and medication changes.' : 'Nothing in this filter.'}
          </div>
        )}
        {view.visible.map(it => {
          const st = itemState(session, it.id);
          const line = script.lines[it.lineIdx];
          const copy = acceptCopy(it);
          const title = session.edits[it.id] || it.title;
          const who = speakerOf(script, line.who, cmName);
          // A medication change with no order behind it says so: it goes to the prescriber.
          const source = it.src ? [['Source', `${it.src[0]} · ${it.src[1]}`]] : it.where === 'Medications' ? [['Source', 'Patient-reported · no order on file']] : [];
          const fields = [...source, ...it.fields];
          const cls = [styles.item, st === 'accepted' ? styles.itemAccepted : '', session.focus === it.id ? styles.itemFocus : ''].filter(Boolean).join(' ');
          return (
            <div key={it.id} className={cls}>
              <div className={styles.itemTop}>
                <Badge size="sm" tone={it.tone} icon={it.icon} label={it.type} />
                {it.id === view.newest && st === 'pending' && <Badge size="sm" tone="primary" variant="outline" label="Just Now" />}
                <span className={styles.spacer} />
                <span className={styles.where}>To {it.where}</span>
              </div>

              {session.editing === it.id ? (
                <div className={styles.editRow}>
                  <Input aria-label="Edit title" value={session.editDraft} onChange={e => session.setEditDraft(e.target.value)} />
                  <Button size="sm" onClick={session.saveEdit}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={session.cancelEdit}>Cancel</Button>
                </div>
              ) : (
                <button type="button" className={styles.itemTitle} onClick={() => session.openDetail(it.id)} title="Open details">{title}</button>
              )}

              <div className={styles.fields}>
                {fields.map(([k, v]) => (
                  <span key={k} className={styles.field}><span className={styles.fieldKey}>{k}</span><span>{fillCm(v, cmName)}</span></span>
                ))}
              </div>

              <button type="button" className={styles.quote} onClick={() => session.focusItem(it.id)} title="Highlight in transcript">
                <Icon name="solar:chat-round-dots-linear" size={14} color="var(--neutral-300)" />
                <span>“{line.hl || fillCm(line.text, cmName)}” <span className={styles.quoteBy}>{who.name.split(' ')[0]} · {line.t}</span></span>
              </button>

              {st === 'pending' && (
                <div className={styles.itemActions}>
                  <Button size="sm" onClick={() => { session.accept(it.id); showToast(it.where === 'Medications' ? `${copy.label}: ${title}` : `${it.type} accepted · saves at wrap-up`); }}>{copy.label}</Button>
                  <Button size="sm" variant="outline" onClick={() => session.startEdit(it.id, title)}>Edit</Button>
                  <span className={styles.spacer} />
                  <Button size="sm" variant="ghost" onClick={() => session.dismiss(it.id)}>Dismiss</Button>
                </div>
              )}
              {st === 'accepted' && (
                <div className={styles.itemActions}>
                  <Icon name="solar:check-circle-linear" size={16} color="var(--status-success)" />
                  <span className={styles.acceptedText}>{copy.done}</span>
                  <Button size="sm" variant="ghost" onClick={() => session.undo(it.id)}>Undo</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
