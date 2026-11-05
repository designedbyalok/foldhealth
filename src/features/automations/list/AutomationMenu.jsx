import { useRef, useState } from 'react';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';

/**
 * The kebab on an automation card or row: History, Edit, Duplicate,
 * Analytics (only once it has run) and Delete.
 */
export function AutomationMenu({ hasRuns, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const items = [
    { key: 'history', icon: 'solar:history-linear', label: 'History' },
    { key: 'edit', icon: 'solar:pen-linear', label: 'Edit' },
    { key: 'duplicate', icon: 'solar:copy-linear', label: 'Duplicate' },
    ...(hasRuns ? [{ key: 'analytics', icon: 'solar:chart-2-linear', label: 'Analytics' }] : []),
    { key: 'delete', icon: 'solar:trash-bin-trash-linear', label: 'Delete', danger: true },
  ];
  return (
    <span onClick={e => e.stopPropagation()}>
      <ActionButton
        ref={ref}
        icon="solar:menu-dots-linear"
        size="sm"
        tooltip="More actions"
        tooltipLeft
        active={open}
        onClick={() => setOpen(v => !v)}
      />
      {open && (
        <MenuPopover
          anchorRef={ref}
          items={items}
          width={160}
          onSelect={(key) => { setOpen(false); onSelect(key); }}
          onClose={() => setOpen(false)}
          ariaLabel="Automation actions"
        />
      )}
    </span>
  );
}

/** Same kebab for a template row: Preview only. */
export function TemplateMenu({ onPreview }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  return (
    <span onClick={e => e.stopPropagation()}>
      <ActionButton ref={ref} icon="solar:menu-dots-linear" size="sm" tooltip="More actions" tooltipLeft active={open} onClick={() => setOpen(v => !v)} />
      {open && (
        <MenuPopover
          anchorRef={ref}
          items={[{ key: 'preview', icon: 'solar:eye-linear', label: 'Preview' }]}
          width={160}
          onSelect={() => { setOpen(false); onPreview(); }}
          onClose={() => setOpen(false)}
          ariaLabel="Template actions"
        />
      )}
    </span>
  );
}
