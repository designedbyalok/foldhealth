import { useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { Toggle } from '../../../../components/Toggle/Toggle';
import { Switch } from '../../../../components/Switch/Switch';
import { SECTIONS, WIDGETS, SAVINGS_CATEGORIES, SCOPE_OPTIONS } from './employerImpactConfig';
import { defaultLayout, savingsKey } from './employerImpactLayout';
import { SortableItem, SortableList } from './SortableParts';
import styles from './UpdateDashboardDrawer.module.css';

const SECTION_TITLES = Object.fromEntries(SECTIONS.map(s => [s.id, s.heading || s.title]));
const WIDGET_TITLES = {
  ...Object.fromEntries(WIDGETS.map(w => [w.key, w.title])),
  ...Object.fromEntries(SAVINGS_CATEGORIES.map(c => [savingsKey(c.key), c.title])),
};

/**
 * Update Dashboard: reorder the report's sections and the widgets inside
 * them, and switch widgets on or off, for each view (All Locations / By
 * Location). The toggle picks which view's layout is being edited, and
 * that view opens on Submit. Changes are a draft until Submit; Reset
 * returns the view on screen to its default layout. Figma 885:132349.
 *
 * @param {object}   props
 * @param {{patient: object, visit: object}} props.layouts – Current layouts (see employerImpactLayout)
 * @param {'patient'|'visit'} props.scope – The view open in the report
 * @param {function} props.onSubmit – (layouts, scope) => void
 * @param {function} props.onClose
 */
export function UpdateDashboardDrawer({ layouts, scope, onSubmit, onClose }) {
  const [drafts, setDrafts] = useState(layouts);
  const [draftScope, setDraftScope] = useState(scope);
  const draft = drafts[draftScope];
  const hidden = new Set(draft.hidden);

  // Edits apply to the view the toggle is on.
  const setDraft = (update) => setDrafts(all => ({ ...all, [draftScope]: update(all[draftScope]) }));

  const setVisible = (key, on) => setDraft(d => ({
    ...d,
    hidden: on ? d.hidden.filter(k => k !== key) : [...d.hidden, key],
  }));

  return (
    <Drawer
      title="Update Dashboard"
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <>
          <Button
            variant="secondary"
            size="L"
            leadingIcon="solar:refresh-linear"
            onClick={() => setDraft(() => defaultLayout(draftScope))}
          >
            Reset
          </Button>
          <span className={styles.headerDivider} aria-hidden="true" />
          <Button variant="primary" size="L" onClick={() => onSubmit(drafts, draftScope)}>Submit</Button>
          <span className={styles.headerDivider} aria-hidden="true" />
        </>
      )}
      bodyClassName={styles.body}
    >
      <div className={styles.scope}>
        <Toggle size="S" items={SCOPE_OPTIONS} active={draftScope} onChange={setDraftScope} />
      </div>

      <div className={styles.sections}>
        <SortableList ids={draft.sections} onReorder={sections => setDraft(d => ({ ...d, sections }))}>
          {draft.sections.map(sectionId => (
            <SortableItem key={sectionId} id={sectionId} label={SECTION_TITLES[sectionId]} className={styles.section}>
              {sectionHandle => (
                <>
                  <div className={styles.sectionHead}>
                    {sectionHandle}
                    <span className={styles.sectionTitle}>{SECTION_TITLES[sectionId]}</span>
                  </div>
                  <div className={styles.list}>
                    <SortableList
                      ids={draft.widgets[sectionId]}
                      onReorder={keys => setDraft(d => ({ ...d, widgets: { ...d.widgets, [sectionId]: keys } }))}
                    >
                      {draft.widgets[sectionId].map(key => (
                        <SortableItem key={key} id={key} label={WIDGET_TITLES[key]} className={styles.row}>
                          {rowHandle => (
                            <>
                              {rowHandle}
                              <span className={styles.rowLabel}>{WIDGET_TITLES[key]}</span>
                              <Switch
                                checked={!hidden.has(key)}
                                onChange={on => setVisible(key, on)}
                                ariaLabel={`Show ${WIDGET_TITLES[key]}`}
                              />
                            </>
                          )}
                        </SortableItem>
                      ))}
                    </SortableList>
                  </div>
                </>
              )}
            </SortableItem>
          ))}
        </SortableList>
      </div>
    </Drawer>
  );
}
