import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Input } from '../../../components/Input/Input';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { UnityIcon } from '../../../components/UnityIcon/UnityIcon';
import { ruleSummaryLines } from './ruleSummaryLines';
import { toSQL, toJsonLogic } from './formatQueryBridge';
import styles from './ruleBuilder.module.css';

/**
 * RuleSummaryPanel: the 320px left rail of the dynamic group detail screen
 * (Figma 1:13951): group identity + description, qualified-member count, and
 * the Applied Filtration Criteria card with the Unity footer.
 */
export function RuleSummaryPanel({ session, query, qualifiedCount, onEdit, onRename, onHistory, onRefresh, showToast }) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(session.name);
  const nameInputRef = useRef(null);
  // The shared Input doesn't reliably forward autoFocus, and without focus a
  // blur can never fire: so commit would silently never run. Focus by ref.
  useEffect(() => { if (editingName) nameInputRef.current?.focus(); }, [editingName]);

  const startRename = () => { setNameDraft(session.name); setEditingName(true); };
  // Enter commits directly and blur commits too, the guard keeps the pair
  // from double-saving when Enter's blur follows the explicit commit.
  const committingRef = useRef(false);
  const commitRename = async () => {
    if (committingRef.current) return;
    committingRef.current = true;
    try {
      const next = nameDraft.trim();
      setEditingName(false);
      if (!next || next === session.name) return;
      const ok = await onRename?.(next);
      if (ok) showToast('Group renamed');
    } finally {
      committingRef.current = false;
    }
  };
  const lines = ruleSummaryLines(query);
  const [exportMode, setExportMode] = useState(null); // null | 'sql' | 'jsonlogic'
  const sqlOutput = useMemo(() => (exportMode === 'sql' ? toSQL(query) : null), [query, exportMode]);
  const jsonOutput = useMemo(() => (exportMode === 'jsonlogic' ? toJsonLogic(query) : null), [query, exportMode]);
  const copyText = () => {
    const text = lines.map(l => (l.kind === 'value' ? `  • ${l.text}` : l.text)).join('\n');
    navigator.clipboard?.writeText(text).then(
      () => showToast('Criteria copied'),
      () => showToast('Copy failed'),
    );
  };

  return (
    <aside className={styles.rail}>
      <div className={styles.railHeader}>
        <div className={styles.railHeaderTop}>
          <Avatar type="icon" variant="patient" iconName="solar:users-group-rounded-linear" size="L" />
          <div className={styles.railHeaderActions}>
            <ActionButton icon="solar:pen-linear" tooltip="Edit" onClick={onEdit} />
            <span className={styles.headerDivider} />
            <ActionButton icon="custom:history" tooltip="History" onClick={onHistory} />
          </div>
        </div>
        {editingName ? (
          <Input
            ref={nameInputRef}
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setNameDraft(session.name); setEditingName(false); }
            }}
            className={styles.railTitleInput}
            aria-label="Group name"
          />
        ) : (
          <button type="button" className={styles.railTitleButton} onClick={startRename} title="Click to rename">
            {session.name}
          </button>
        )}
        {session.description ? <div className={styles.railDescription}>{session.description}</div> : null}
      </div>

      <div className={styles.railScroll}>
        <div className={styles.railCount}>
          <span className={styles.railSectionLabel}>Qualified Members</span>
          <span className={styles.railCountValue}>{qualifiedCount ?? '-'}</span>
        </div>

        <div className={styles.railCriteria}>
          <span className={styles.railSectionLabel}>Applied Filtration Criteria</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <ActionButton
              icon="solar:code-square-linear"
              size="sm"
              tooltip="Export as SQL"
              style={exportMode === 'sql' ? { color: 'var(--primary-300)' } : undefined}
              onClick={() => setExportMode(m => m === 'sql' ? null : 'sql')}
            />
            <ActionButton
              icon="solar:programming-linear"
              size="sm"
              tooltip="Export as JsonLogic"
              style={exportMode === 'jsonlogic' ? { color: 'var(--primary-300)' } : undefined}
              onClick={() => setExportMode(m => m === 'jsonlogic' ? null : 'jsonlogic')}
            />
          </div>
          <div className={styles.criteriaCard}>
            <div className={styles.criteriaBody}>
              {lines.length === 0
                ? <span className={styles.criteriaEmpty}>No conditions defined yet.</span>
                : lines.map((l, i) => (
                  <div
                    key={`${l.text}-${i}`}
                    className={l.kind === 'value' ? styles.criteriaValue : styles.criteriaLine}
                    style={l.depth ? { paddingLeft: l.depth * 14 + (l.kind === 'value' ? 16 : 0) } : undefined}
                  >
                    {l.kind === 'value' ? `• ${l.text}` : l.text}
                  </div>
                ))}
            </div>
            <div className={styles.criteriaFooter}>
              <span className={styles.unityBrand}>
                <UnityIcon size={16} color="var(--primary-300)" />
                <span className={styles.unityText}>Powered by Unity</span>
                <span className={styles.unityAlpha}>ALPHA</span>
              </span>
              <span className={styles.criteriaFooterActions}>
                <ActionButton icon="solar:copy-linear" size="sm" tooltip="Copy Text" onClick={copyText} />
                <ActionButton icon="solar:refresh-linear" size="sm" tooltip="Refresh" onClick={onRefresh} />
              </span>
            </div>
          </div>

          {exportMode === 'sql' && sqlOutput && (
            <div className={styles.exportSection}>
              <span className={styles.exportLabel}>Generated SQL</span>
              <pre className={styles.exportCode}>{sqlOutput.sql}</pre>
            </div>
          )}

          {exportMode === 'jsonlogic' && jsonOutput && (
            <div className={styles.exportSection}>
              <span className={styles.exportLabel}>JsonLogic</span>
              <pre className={styles.exportCode}>{JSON.stringify(jsonOutput, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
