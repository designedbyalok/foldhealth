import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Badge } from '../../../../components/Badge/Badge';
import { TableSkeleton } from '../../../../components/TableSkeleton/TableSkeleton';
import { useAppStore } from '../../../../store/useAppStore';
import { versionDiff, versionState } from '../lib/templateVersions';
import styles from './Versions.module.css';

const STATE = {
  current: { label: 'Current', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  past: { label: 'Past', tone: 'grey' },
};
const MODE = { all: 'All plans migrated', cohort: 'A cohort migrated', review: 'Plans move at their next review' };
const usDate = (iso) => (iso ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : '');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A template's version chain: what each version changed, when it took effect, and how many plans are on it. */
export function TemplateVersionsDrawer({ template, onClose }) {
  const versions = useAppStore(s => s.carePlanTemplateVersions[template.id]) || [];
  const fetchImpact = useAppStore(s => s.fetchCarePlanTemplateImpact);
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let live = true;
    fetchImpact(template.id).then(r => { if (live) setRows(r); });
    return () => { live = false; };
  }, [template.id, fetchImpact]);

  const onVersion = useMemo(() => {
    const m = new Map();
    for (const r of rows || []) m.set(r.versionNumber, (m.get(r.versionNumber) || 0) + 1);
    return m;
  }, [rows]);
  const pendingOn = useMemo(() => {
    const m = new Map();
    for (const r of rows || []) if (r.pendingVersionNumber) m.set(r.pendingVersionNumber, (m.get(r.pendingVersionNumber) || 0) + 1);
    return m;
  }, [rows]);
  const chain = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <Drawer title={`${template.name}: versions`} onClose={onClose}>
      {!versions.length ? (
        <p className={styles.muted}>No versions yet. The first one is recorded when the template is published.</p>
      ) : (
        <ol className={styles.chain}>
          {chain.map((v) => {
            const state = STATE[versionState(v, versions)];
            const prev = versions.find(x => x.versionNumber === v.versionNumber - 1);
            const diff = prev ? versionDiff(prev.content, v.content) : null;
            const counts = diff && ['goal', 'intervention', 'barrier']
              .map(k => [k, diff[k].added.length, diff[k].removed.length]).filter(([, a, r]) => a || r)
              .map(([k, a, r]) => `${k}s ${a ? `+${a}` : ''}${a && r ? ' ' : ''}${r ? `−${r}` : ''}`);
            return (
              <li key={v.id} className={styles.version}>
                <div className={styles.versionHead}>
                  <span className={styles.versionName}>Version {v.versionNumber}</span>
                  <Badge tone={state.tone} size="sm" label={state.label} />
                  <span className={styles.versionDate}>Effective {usDate(v.effectiveDate)}</span>
                </div>
                {v.note && <p className={styles.versionNote}>{v.note}</p>}
                <p className={styles.muted}>
                  {[
                    counts?.length ? `Changes: ${counts.join(', ')}` : prev ? 'No items added or removed' : null,
                    v.migration?.mode ? MODE[v.migration.mode] : null,
                    v.publishedBy ? `Published by ${v.publishedBy}` : null,
                  ].filter(Boolean).join(' • ')}
                </p>
                <p className={styles.muted}>
                  {rows ? [
                    `${plural(onVersion.get(v.versionNumber) || 0, 'active plan')} on it`,
                    pendingOn.get(v.versionNumber) ? `${pendingOn.get(v.versionNumber)} waiting to move` : null,
                  ].filter(Boolean).join(' • ') : 'Counting plans…'}
                </p>
              </li>
            );
          })}
        </ol>
      )}
      {!rows && <TableSkeleton rows={2} />}
    </Drawer>
  );
}
