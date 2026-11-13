import { useEffect, useRef, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { CollapsibleSection } from '../../../components/CollapsibleSection/CollapsibleSection';
import { RadioOptionGroup } from '../../../components/RadioOptionGroup/RadioOptionGroup';
import { DatePicker } from '../../../components/DatePicker/DatePicker';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { Select } from '../../../components/Select/Select';
import { DATE_PRESETS, EMPTY_COMMS_FILTERS } from './commsFilters';
import { inboxLabel } from './commsInboxes';
import styles from './Comms.module.css';

const toggle = (list, v) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

/**
 * Comms list filters: By Date (a preset or a Start - End range), By Channel
 * on All Conversations, and a Covering for dropdown (whose conversations I'm
 * covering) while I'm covering someone. Picks are kept as a draft until Apply.
 *
 * @param {object}   props.value     – the applied filters (EMPTY_COMMS_FILTERS shape)
 * @param {function} props.onApply   – (filters) => void
 * @param {function} props.onClose
 * @param {string[]} [props.channels] – channel names to offer (All Conversations only)
 * @param {string[]} [props.coveringNames] – people I'm covering
 * @param {{ id, name, address }[]} [props.inboxes] – this list's inboxes (By Inbox)
 */
export function CommsFilterDrawer({ value, onApply, onClose, channels = [], coveringNames = [], inboxes = [] }) {
  const [draft, setDraft] = useState(value);
  const set = (patch) => setDraft(d => ({ ...d, ...patch }));
  // Custom opens the range's calendar as soon as it's picked.
  const rangeRef = useRef(null);
  const openRangeNext = useRef(false);
  useEffect(() => {
    if (draft.date !== 'custom' || !openRangeNext.current) return;
    openRangeNext.current = false;
    rangeRef.current?.open?.();
  }, [draft.date]);

  return (
    <Drawer
      title="Filters"
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <>
          <Button variant="outline" tone="neutral" onClick={() => setDraft(EMPTY_COMMS_FILTERS)}>Reset Filter</Button>
          <Button onClick={() => { onApply(draft); onClose(); }}>Apply</Button>
          <span className={styles.headerDivider} aria-hidden="true" />
        </>
      )}
    >
      <div className={styles.filterDrawer}>
        <CollapsibleSection icon="solar:calendar-linear" title="By Date">
          <RadioOptionGroup
            name="commsDateFilter"
            orientation="horizontal"
            options={DATE_PRESETS}
            value={draft.date}
            onChange={(v) => {
              set({ date: v, range: v === 'custom' ? draft.range : null });
              if (v === 'custom') openRangeNext.current = true;
            }}
          />
          {draft.date === 'custom' && (
            <div className={styles.filterRange}>
              <DatePicker
                ref={rangeRef}
                mode="range"
                value={draft.range || { start: '', end: '' }}
                onSelect={(range) => set({ range })}
                placeholder="Start - End"
              />
            </div>
          )}
        </CollapsibleSection>

        {inboxes.length > 0 && (
          <CollapsibleSection icon="solar:inbox-linear" title="By Inbox">
            <Select
              portal
              clearable
              placeholder="Select Inbox"
              aria-label="Inbox"
              options={inboxes.map(i => ({ value: i.id, label: inboxLabel(i) }))}
              value={draft.inbox || ''}
              onValueChange={(v) => set({ inbox: v || null })}
            />
          </CollapsibleSection>
        )}

        {channels.length > 0 && (
          <CollapsibleSection icon="solar:chat-round-linear" title="By Channel">
            <div className={styles.filterChecks}>
              {channels.map(c => (
                <label key={c} className={styles.filterCheck}>
                  <Checkbox checked={draft.channels.includes(c)} onCheckedChange={() => set({ channels: toggle(draft.channels, c) })} />
                  {c}
                </label>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {coveringNames.length > 0 && (
          <Select
            label="Covering for"
            multiple
            checkboxes
            portal
            searchable={coveringNames.length > 8}
            placeholder="Select Users"
            options={coveringNames.map(n => ({ value: n, label: n }))}
            value={draft.covering}
            onValueChange={(v) => set({ covering: v || [] })}
          />
        )}
      </div>
    </Drawer>
  );
}
