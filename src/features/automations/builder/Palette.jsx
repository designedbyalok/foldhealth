import { useMemo, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { DragHandleIcon } from '../../../components/Icon/DragHandleIcon';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { ACTIONS, CONDITIONS, FAMILY, LOGIC, triggerDef } from '../lib/catalog';
import { DRAG_TYPE } from '../canvas/CanvasNodes';
import styles from './AutomationBuilder.module.css';

const GROUP_FAMILY = { Send: 'send', Order: 'order', Add: 'add', 'Care plan': 'add' };

/**
 * The left builder panel: the trigger, the logic tiles, and every condition
 * and action, draggable onto a "+" on the canvas (or click to add at the
 * selected spot). Items the selected spot can't take are disabled with the
 * reason on hover.
 */
export function Palette({ triggerType, onPickTrigger, isAllowed, whyNot, onAdd, tourIds = {} }) {
  const [tab, setTab] = useState('conditions');
  const [query, setQuery] = useState('');
  const trig = triggerDef(triggerType);
  const q = query.trim().toLowerCase();

  const groups = useMemo(() => {
    const list = tab === 'conditions' ? CONDITIONS : ACTIONS.filter(a => !a.triggers || a.triggers.includes(triggerType));
    const out = [];
    list.filter(i => !q || i.label.toLowerCase().includes(q)).forEach(i => {
      let g = out.find(x => x.group === i.group);
      if (!g) { g = { group: i.group, items: [] }; out.push(g); }
      g.items.push(i);
    });
    return out;
  }, [tab, q, triggerType]);

  const item = (def, family) => {
    const disabled = !isAllowed(def.type);
    const row = (
      <div
        key={def.type}
        className={`${styles.paletteRow} ${disabled ? styles.paletteRowDisabled : ''}`}
        draggable={!disabled}
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_TYPE, def.type);
          e.dataTransfer.effectAllowed = 'copy';
        }}
        onClick={() => !disabled && onAdd(def.type)}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onKeyDown={(e) => { if (e.key === 'Enter' && !disabled) onAdd(def.type); }}
      >
        <DragHandleIcon size={14} className={styles.dragHandle} />
        <Icon name={def.icon} size={16} color={disabled ? 'var(--neutral-200)' : FAMILY[family]?.color} />
        <span className={styles.paletteLabel}>{family === 'condition' ? `If ${def.label.charAt(0).toLowerCase()}${def.label.slice(1)}` : def.label}</span>
        {def.help || def.helper ? (
          <Tooltip label={def.help || def.helper} maxWidth={240}>
            <span className={styles.paletteInfo}><Icon name="solar:info-circle-linear" size={14} /></span>
          </Tooltip>
        ) : null}
      </div>
    );
    return disabled ? <Tooltip key={def.type} label={whyNot(def.type)}>{row}</Tooltip> : row;
  };

  return (
    <aside className={styles.palette}>
      <span className={styles.paletteSection}>Run automation</span>
      <button
        type="button"
        id={tourIds.trigger}
        className={`${styles.triggerCard} ${trig ? styles.triggerCardSet : ''}`}
        onClick={onPickTrigger}
      >
        <Icon name={trig?.icon || 'solar:bolt-linear'} size={18} />
        <span>{trig?.label || 'Select Trigger'}</span>
      </button>

      <div id={tourIds.palette} className={styles.paletteBody}>
        <div className={styles.logicGrid}>
          {LOGIC.map(l => {
            const disabled = !isAllowed(l.type);
            return (
              <Tooltip key={l.type} label={disabled ? whyNot(l.type) : l.help} maxWidth={240}>
                <div
                  className={`${styles.logicTile} ${disabled ? styles.logicTileDisabled : ''}`}
                  draggable={!disabled}
                  onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, l.type); e.dataTransfer.effectAllowed = 'copy'; }}
                  onClick={() => !disabled && onAdd(l.type)}
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  aria-disabled={disabled}
                >
                  <Icon name={l.icon} size={18} />
                  <span>{l.label}</span>
                </div>
              </Tooltip>
            );
          })}
        </div>

        <Input
          leadingIcon="solar:magnifer-linear"
          placeholder="Search action or condition"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search action or condition"
        />

        <div className={styles.paletteTabs} role="tablist">
          {[['conditions', 'Conditions'], ['actions', 'Actions']].map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={`${styles.paletteTab} ${tab === k ? styles.paletteTabActive : ''}`}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {!triggerType ? (
          <div className={styles.paletteEmpty}>
            <Icon name="solar:bolt-linear" size={32} color="var(--primary-300)" />
            <p>The chosen trigger will determine which conditions and actions can be applied.</p>
          </div>
        ) : groups.length === 0 ? (
          <div className={styles.paletteEmpty}>
            <EmptyState icon="solar:magnifer-linear" size="sm" title={`Nothing matches “${query}”`} />
          </div>
        ) : (
          <div className={styles.paletteGroups}>
            {groups.map(g => {
              const family = tab === 'conditions' ? 'condition' : GROUP_FAMILY[g.group] || 'add';
              return (
                <div key={g.group} className={styles.paletteGroup}>
                  <span className={styles.paletteSection}>{g.group}</span>
                  <div className={`${styles.paletteBox} ${styles[`box_${family}`]}`}>
                    {g.items.map(i => item(i, family))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
