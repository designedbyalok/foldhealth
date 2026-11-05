import { useMemo, useRef, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../components/Icon/DownChevronIcon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { POS_BY_VT, PROVIDER_POOL_BY_VT } from '../reference/visitTypes';
import { DOS_CUSTOM, isDosOnAnyRow, canSaveCard, buildEffectiveDosOptions, resolveDosEntry, populateFieldsFromEntry, todayIso } from './IcdCard.utils';
import { IcdCardBody } from './IcdCardBody';
import { SelectNewDosPopover } from './SelectNewDosPopover';
import styles from './NewDiagGapPanel.module.css';

/**
 * IcdCard: the pick-an-ICD editor card rendered inline on the RHS of the
 * DiagPanel. Each picked ICD (from the toolbar's + ICD flow) becomes its
 * own card at the top of the associated-ICDs list with a per-card Save.
 *
 * DOS field auto-populates Provider/POS/VT for existing dos_list dates
 * (either this row's or a sibling Created-date row's); picking a brand-new
 * custom date leaves them empty and triggers a new-row spawn on save.
 */
export function IcdCard({
  card, member, memberDosList, memberDocs,
  dosOptions, posOptions, vtOptions, docTypeOptions, providerAll,
  onUpdate, onRemove, onSave,
}) {
  const [dragOver, setDragOver] = useState(false);
  // Anchor ref for the DOS field, SelectNewDosPopover positions itself
  // against this so the calendar view sits exactly where the Select's
  // dropdown was.
  const dosFieldRef = useRef(null);
  // Two-view popover state: when the user picks "+ Add New DOS" in the
  // Select, the list dismisses and this calendar view opens with a back
  // arrow that returns them to the list.
  const [customDosOpen, setCustomDosOpen] = useState(false);
  const [customAnchorRect, setCustomAnchorRect] = useState(null);

  const priorOccurrences = useMemo(() => {
    if (!card.pick?.code || !member?.dos_list) return 0;
    return (member.dos_list || []).filter(d => d?.icd === card.pick.code).length
      || Math.min(member.dos_list.length, 2);
  }, [card.pick?.code, member?.dos_list]);

  const providerOptions = useMemo(() => {
    const pool = card.visitType ? PROVIDER_POOL_BY_VT[card.visitType] : Object.values(PROVIDER_POOL_BY_VT).flat();
    return [...new Set(pool)].map(n => ({ value: n, label: n }));
  }, [card.visitType]);

  const dosIsExisting = isDosOnAnyRow(card);

  const effectiveDosOptions = useMemo(
    () => buildEffectiveDosOptions(card.dosList, dosOptions),
    [card.dosList, dosOptions],
  );

  const handleDosMultiChange = (nextValues) => {
    // Rebuild dosList so we keep the entry shape (mode/memberId) rather
    // than losing it. Preserve the order in which values were added.
    const prevByValue = new Map(card.dosList.map(d => [d.value, d]));
    const nextList = nextValues.map(v => prevByValue.get(v) || resolveDosEntry(v, dosOptions, member?.id));

    const patch = { dosList: nextList };
    // Auto-populate on the first DOS pick, leaving form values untouched
    // after the user has already selected multiple.
    if (nextList.length === 1 && card.dosList.length === 0) {
      const only = nextList[0];
      patch.provider = '';
      patch.pos = '';
      patch.visitType = '';
      patch.docType = '';
      patch.linkedDocIds = new Set();
      patch.showUpload = false;
      populateFieldsFromEntry(only, patch, memberDosList);
    }
    onUpdate(patch);
  };

  const handleDosSelect = (nextValueOrList) => {
    // singleAction items (Custom Date) still come through as a scalar in
    // multi mode. Snapshot the field's DOMRect and open the Select New DOS
    // calendar view: replaces the native OS picker with an in-app popover
    // that matches Figma (back arrow + month grid).
    if (nextValueOrList === DOS_CUSTOM) {
      const rect = dosFieldRef.current?.getBoundingClientRect() || null;
      setCustomAnchorRect(rect);
      setCustomDosOpen(true);
      return;
    }
    handleDosMultiChange(Array.isArray(nextValueOrList) ? nextValueOrList : [nextValueOrList]);
  };

  const handleCustomDate = (iso) => {
    if (!iso) return;
    const [y, m, d] = iso.split('-');
    const formatted = `${m}/${d}/${y}`;
    // Append this custom date to the existing dosList (don't clobber). If
    // it's already in the list (user re-picked the same date), no-op.
    if (card.dosList.some(x => x.value === formatted)) return;
    const nextList = [...card.dosList, { value: formatted, dosDate: formatted, memberId: null, mode: 'custom' }];
    const patch = { dosList: nextList };
    if (card.dosList.length === 0) {
      // First DOS is a custom → clear autoderived defaults so the user
      // fills provider/POS/VT explicitly.
      patch.provider = '';
      patch.pos = '';
      patch.visitType = '';
      patch.docType = '';
      patch.linkedDocIds = new Set();
      patch.showUpload = false;
    }
    onUpdate(patch);
  };

  const handleVtChange = (vt) => {
    const p = POS_BY_VT[vt];
    const pool = PROVIDER_POOL_BY_VT[vt] || [];
    onUpdate({
      visitType: vt,
      pos: p?.code || card.pos,
      provider: card.provider || pool[0] || '',
    });
  };

  const toggleLinkedDoc = (id) => {
    onUpdate(c => {
      const next = new Set(c.linkedDocIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { linkedDocIds: next };
    });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onUpdate({ file: f });
  };

  const showDropzone = !dosIsExisting || card.showUpload;
  const showEvidenceList = dosIsExisting;
  const saveDisabled = !!onSave && !canSaveCard(card);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <button
          type="button"
          className={styles.chevronBtn}
          onClick={() => onUpdate({ collapsed: !card.collapsed })}
          aria-label={card.collapsed ? 'Expand' : 'Collapse'}
        >
          <DownChevronIcon
            size={16}
            color="var(--neutral-400)"
            style={card.collapsed ? { transform: 'rotate(-90deg)' } : undefined}
          />
        </button>
        <div className={styles.cardHeaderMain}>
          <div className={styles.icdTitle}>
            <span className={styles.icdCode}>{card.pick.code}</span>
            <span className={styles.icdDesc}> - {card.pick.title}</span>
          </div>
          <div className={styles.icdMeta}>
            {card.pick.hcc && (
              <span className={styles.hccLabel}>
                {(card.pick.hcc || '').replace(/ - .*$/, '')} (v28)
              </span>
            )}
            {card.pick.hcc && <span className={styles.metaDivider} />}
            <span className={styles.occursBadge}>
              <Icon name="custom:history" size={10} color="var(--neutral-300)" />
              <span>Occurs {priorOccurrences}x</span>
              <Icon name="solar:alt-arrow-right-linear" size={10} color="var(--neutral-300)" />
            </span>
          </div>
        </div>
        {!onSave && (
          <ActionButton
            size="sm"
            icon="solar:trash-bin-2-linear"
            tooltip="Remove"
            onClick={onRemove}
          />
        )}
      </div>

      {!card.collapsed && (
        <IcdCardBody
          card={card}
          memberDocs={memberDocs}
          effectiveDosOptions={effectiveDosOptions}
          providerOptions={providerOptions}
          providerAll={providerAll}
          posOptions={posOptions}
          vtOptions={vtOptions}
          docTypeOptions={docTypeOptions}
          dosIsExisting={dosIsExisting}
          showEvidenceList={showEvidenceList}
          showDropzone={showDropzone}
          saveDisabled={saveDisabled}
          dragOver={dragOver}
          dosFieldRef={dosFieldRef}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onSave={onSave}
          handleDosSelect={handleDosSelect}
          handleCustomDate={handleCustomDate}
          handleVtChange={handleVtChange}
          toggleLinkedDoc={toggleLinkedDoc}
          setDragOver={setDragOver}
          onDrop={onDrop}
        />
      )}
      <SelectNewDosPopover
        open={customDosOpen}
        anchorRect={customAnchorRect}
        max={todayIso()}
        onBack={() => {
          setCustomDosOpen(false);
          // Return to the DOS Select's list: click the trigger button
          // inside the DOS field wrapper so the dropdown re-opens as if
          // the user had clicked it themselves.
          const trigger = dosFieldRef.current?.querySelector('button[aria-expanded]');
          setTimeout(() => trigger?.click(), 0);
        }}
        onSelect={(iso) => { handleCustomDate(iso); setCustomDosOpen(false); }}
      />
    </div>
  );
}
