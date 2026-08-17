import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Input } from '../../../components/Input/Input';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { UnityIcon } from '../../../components/UnityIcon/UnityIcon';
import { FIELD_BY_KEY, ruleSummary } from './fieldCatalog';
import styles from './ruleBuilder.module.css';

/* Nested plain-text lines of the rule tree for the criteria card — the same
   copy the node badges show, arranged Figma-style: field heading, indented
   value line, combinator between conditions. */
function summaryLines(query) {
  const lines = [];
  const walk = (group, depth) => {
    const combinator = (group.combinator || 'and').toUpperCase();
    (group.rules || []).forEach((node, i) => {
      if (i > 0) lines.push({ text: combinator, kind: 'combinator', depth });
      if (Array.isArray(node.rules)) { walk(node, depth + 1); return; }
      const field = FIELD_BY_KEY[node.field];
      if (!field) return;
      lines.push({ text: field.label, kind: 'field', depth });
      const badges = ruleSummary(node);
      badges.forEach(b => lines.push({ text: b.text, kind: 'value', depth }));
    });
  };
  if (query) walk(query, 0);
  return lines;
}

/**
 * RuleSummaryPanel — the 320px left rail of the dynamic group detail screen
 * (Figma 1:13951): group identity + description, qualified-member count, and
 * the Applied Filtration Criteria card with the Unity footer.
 */
export function RuleSummaryPanel({ session, query, qualifiedCount, onEdit, onRename, onHistory, onRefresh, showToast }) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(session.name);
  const nameInputRef = useRef(null);
  // The shared Input doesn't reliably forward autoFocus, and without focus a
  // blur can never fire — so commit would silently never run. Focus by ref.
  useEffect(() => { if (editingName) nameInputRef.current?.focus(); }, [editingName]);

  const startRename = () => { setNameDraft(session.name); setEditingName(true); };
  // Enter commits directly and blur commits too — the guard keeps the pair
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
  const lines = summaryLines(query);
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
            <ActionButton icon="solar:pen-linear" size="L" tooltip="Edit" onClick={onEdit} />
            <span className={styles.headerDivider} />
            <ActionButton icon="custom:history" size="L" tooltip="History" onClick={onHistory} />
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
                <ActionButton icon="solar:copy-linear" size="S" tooltip="Copy Text" onClick={copyText} />
                <ActionButton icon="solar:refresh-linear" size="S" tooltip="Refresh" onClick={onRefresh} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
