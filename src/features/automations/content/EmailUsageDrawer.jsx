import { useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Badge } from '../../../components/Badge/Badge';
import { Switch } from '../../../components/Switch/Switch';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { Icon } from '../../../components/Icon/Icon';
import { useAppStore } from '../../../store/useAppStore';
import { FlowIcons } from '../shared/FlowIcons';
import { statusDef } from '../lib/catalog';
import { automationsUsingEmail, templatesUsingEmail, usedByLabel } from './emailUsage';
import styles from './EmailUsage.module.css';

function UsageCard({ automation, onOpen }) {
  const setAutomationStatus = useAppStore(s => s.setAutomationStatus);
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const status = statusDef(automation.status);
  const isDraft = automation.status === 'draft';

  const toggle = async (on) => {
    setSaving(true);
    try { await setAutomationStatus(automation.id, on ? 'active' : 'inactive'); } finally { setSaving(false); }
  };

  return (
    <li className={styles.card}>
      <div className={styles.cardTop}>
        <FlowIcons graph={automation.graph} />
        <span ref={menuRef} className={styles.kebab}>
          <ActionButton icon="solar:menu-dots-linear" size="sm" tooltip="More" onClick={() => setMenu(m => !m)} />
        </span>
        {menu && (
          <MenuPopover
            anchorRef={menuRef}
            width={180}
            items={[{ key: 'open', icon: 'solar:pen-linear', label: 'Open in builder' }]}
            onSelect={() => { setMenu(false); onOpen(automation.id); }}
            onClose={() => setMenu(false)}
            ariaLabel={`${automation.name} actions`}
          />
        )}
      </div>
      <span className={styles.cardName}>{automation.name}</span>
      <div className={styles.cardDivider} />
      <div className={styles.cardBottom}>
        {isDraft ? (
          <Badge tone={status.tone} size="sm" label={status.label} />
        ) : (
          <>
            <Switch
              checked={automation.status === 'active'}
              disabled={saving}
              onChange={toggle}
              ariaLabel={`Turn ${automation.name} ${automation.status === 'active' ? 'off' : 'on'}`}
            />
            <Badge tone={status.tone} size="sm" label={status.label} />
          </>
        )}
      </div>
    </li>
  );
}

/**
 * Lists the automations that send an email (Figma 2966:141397) so they can be
 * turned off or repointed before the email is deleted. Reads the store so a
 * switch flip shows at once.
 */
export function EmailUsageDrawer({ emailIds, emailName, deleting = false, onDelete, onClose }) {
  const automations = useAppStore(s => s.automations);
  const templates = useAppStore(s => s.automationTemplates);
  const setSettingsNavItem = useAppStore(s => s.setSettingsNavItem);
  const openAutomationBuilder = useAppStore(s => s.openAutomationBuilder);
  const used = useMemo(() => automationsUsingEmail(automations, emailIds), [automations, emailIds]);
  const usedTemplates = useMemo(() => templatesUsingEmail(templates, emailIds), [templates, emailIds]);
  const several = emailIds.length > 1;

  const openInBuilder = (id) => {
    setSettingsNavItem('automations');
    openAutomationBuilder(id);
  };

  const title = (
    <span className={styles.titleStack}>
      <span className={styles.titleMain}>Automations using {several ? 'these emails' : 'this email'}</span>
      <span className={styles.titleSub}>{emailName}</span>
    </span>
  );

  const headerRight = (
    <>
      <Button variant="soft" tone="danger" leadingIcon="solar:trash-bin-trash-linear" onClick={() => onDelete()} loading={deleting}>
        {several ? 'Delete emails' : 'Delete email'}
      </Button>
      <span className={styles.headerDivider} />
    </>
  );

  return (
    <Drawer title={title} width={500} onClose={onClose} headerRight={headerRight} noCloseDivider bodyClassName={styles.body}>
      {used.length ? (
        <p className={styles.note}>
          {usedByLabel(used.length)}. Turn an automation off, or open it in the builder to pick another email, before you delete.
        </p>
      ) : null}
      {used.length ? (
        <ul className={styles.list}>
          {used.map(a => <UsageCard key={a.id} automation={a} onOpen={openInBuilder} />)}
        </ul>
      ) : (
        <p className={styles.empty}>No automations send {several ? 'these emails' : 'this email'} anymore.</p>
      )}
      {usedTemplates.length > 0 && (
        <section className={styles.templates}>
          <span className={styles.sectionLabel}>Templates</span>
          <p className={styles.note}>New automations made from these templates will need another email.</p>
          <ul className={styles.templateList}>
            {usedTemplates.map(t => (
              <li key={t.id} className={styles.templateRow}>
                <Icon name="solar:widget-linear" size={16} color="var(--neutral-300)" />
                <span>{t.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Drawer>
  );
}
