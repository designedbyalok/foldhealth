import { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../components/Icon/Icon';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { Badge } from '../../../components/Badge/Badge';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Switch } from '../../../components/Switch/Switch';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { Drawer } from '../../../components/Drawer/Drawer';
import { SimpleTableSkeleton } from '../../../components/SimpleTableSkeleton/SimpleTableSkeleton';
import { useAppStore } from '../../../store/useAppStore';
import { DOMAINS } from '../../../data/embeddedComponents';
import { AuditLogDrawer } from './AuditLogDrawer';

const PLACEMENT_LABELS = {
  'p360-tab': 'P360 tab',
  'side-drawer': 'Side-drawer',
  'widget-card': 'Widget card',
  'action-menu': 'Action menu',
  tab: 'Sidecar tab',
  widget: 'Sidecar widget',
  'profile-tab': 'Mobile tab',
  'list-action': 'Mobile action',
  'widget-card-mobile': 'Mobile widget',
  'home-card': 'Home card',
};

const SURFACE_LABELS = { web: 'Fold Web', sidecar: 'Sidecar', mobile: 'Mobile' };

const thStyle = {
  textAlign: 'left', padding: '8px 16px', color: 'var(--neutral-300)', fontWeight: 500,
  fontSize: 12, whiteSpace: 'nowrap', borderBottom: '0.5px solid var(--neutral-150)',
  background: 'var(--neutral-0)', position: 'sticky', top: 0,
};
const tdStyle = { padding: '12px 16px', fontSize: 14, fontWeight: 400, color: 'var(--neutral-300)', verticalAlign: 'middle' };

/* ── 3-dot action dropdown ── */
function ComponentActionMenu({ comp, onClose, onEdit, onAuditLog, onDuplicate, onRequestDelete }) {
  return (
    <div style={{
      background: 'var(--neutral-0)', border: '0.5px solid var(--neutral-150)',
      borderRadius: 8, minWidth: 180, boxShadow: 'var(--shadow-popover)',
      overflow: 'hidden',
    }} onClick={e => e.stopPropagation()}>
      <button style={menuItemStyle} onClick={() => { onEdit(comp.id); onClose(); }}>
        <Icon name="solar:pen-new-square-linear" size={16} color="var(--neutral-300)" />
        Edit Component
      </button>
      <button style={menuItemStyle} onClick={() => { onAuditLog(comp); onClose(); }}>
        <Icon name="solar:history-linear" size={16} color="var(--neutral-300)" />
        Audit Log
      </button>
      <button style={menuItemStyle} onClick={() => { onDuplicate(comp); onClose(); }}>
        <Icon name="solar:copy-linear" size={16} color="var(--neutral-300)" />
        Duplicate
      </button>
      <div style={{ height: 1, background: 'var(--neutral-100)', margin: '2px 0' }} />
      <button style={{ ...menuItemStyle, color: 'var(--status-error)' }} onClick={() => { onClose(); onRequestDelete(comp); }}
        onMouseOver={e => e.currentTarget.style.background = 'var(--status-error-light)'}
        onMouseOut={e => e.currentTarget.style.background = ''}
      >
        <Icon name="solar:trash-bin-minimalistic-linear" size={16} color="var(--status-error)" />
        Delete
      </button>
    </div>
  );
}

const menuItemStyle = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
  fontSize: 13, fontWeight: 400, color: 'var(--neutral-400)', cursor: 'pointer',
  border: 'none', background: 'none', width: '100%', textAlign: 'left',
  fontFamily: "'Inter', sans-serif", transition: 'background .1s',
};

function ComponentRow({ comp, onToggle, onEdit, onPreview, onAuditLog, onDuplicate, onRequestDelete }) {
  const isDomainRemoved = comp.domainRemoved;
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const moreBtnRef = useRef(null);

  const handleMoreClick = (e) => {
    e.stopPropagation();
    const btn = moreBtnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const menuH = 200;
      setMenuPos({
        top: spaceBelow < menuH ? Math.max(8, rect.top - menuH) : rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setShowMenu(v => !v);
  };

  useEffect(() => {
    if (!showMenu) return;
    const close = (e) => {
      if (moreBtnRef.current && !moreBtnRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showMenu]);

  return (
    <tr
      style={{
        borderBottom: '0.5px solid var(--neutral-100)',
        transition: 'background .1s',
        ...(!comp.enabled ? { opacity: 0.55 } : {}),
      }}
      onMouseOver={e => e.currentTarget.style.background = 'var(--primary-25, #faf8ff)'}
      onMouseOut={e => e.currentTarget.style.background = ''}
    >
      {/* Component name */}
      <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--neutral-400)' }}>
        <div>
          <div>{comp.name}</div>
          <div style={{ fontSize: 12, color: 'var(--neutral-300)', fontWeight: 400, marginTop: 1 }}>
            {comp.category || 'Uncategorized'}
          </div>
        </div>
      </td>

      {/* Domain */}
      <td style={tdStyle}>
        <code style={{
          background: 'var(--neutral-50)', padding: '2px 6px', borderRadius: 4,
          fontSize: 11, fontFamily: "'SF Mono', 'Fira Code', monospace",
          color: 'var(--neutral-400)',
        }}>
          {comp.domain}
        </code>
        {isDomainRemoved && (
          <div style={{ marginTop: 2 }}>
            <Badge variant="compliance-warn" label="Domain removed" />
          </div>
        )}
      </td>

      {/* Surfaces / placements */}
      <td style={tdStyle}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {comp.surfaces?.map(surface => {
            const placement = comp.placements?.[surface];
            const label = placement ? (PLACEMENT_LABELS[placement] || placement) : SURFACE_LABELS[surface];
            return <Badge key={surface} variant="ai-neutral" label={label} />;
          })}
        </div>
      </td>

      {/* Errors 24h — with tooltip on hover */}
      <td style={tdStyle}>
        {comp.errors24h > 0 ? (
          <span
            title={comp.errors24h >= 3 ? `${comp.errors24h} errors in 24h — component may be misconfigured or domain unreachable` : `${comp.errors24h} warning(s) in 24h — intermittent issues detected`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: comp.errors24h >= 3 ? 'var(--status-error)' : 'var(--status-warning)', fontSize: 14, fontWeight: 500, cursor: 'help' }}
          >
            <Icon name={comp.errors24h >= 3 ? 'solar:close-circle-bold' : 'solar:danger-triangle-linear'} size={14} color={comp.errors24h >= 3 ? 'var(--status-error)' : 'var(--status-warning)'} />
            {comp.errors24h}
          </span>
        ) : (
          <span style={{ color: 'var(--neutral-300)' }}>0</span>
        )}
      </td>

      {/* Enabled toggle */}
      <td style={tdStyle}>
        <Switch
          checked={comp.enabled}
          onChange={() => onToggle(comp.id)}
          disabled={isDomainRemoved}
        />
      </td>

      {/* Actions: Edit | Audit Log | More (3-dot) */}
      <td style={tdStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ActionButton icon="solar:pen-linear" size="L" tooltip="Edit" onClick={() => onEdit(comp.id)} />
          <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
          <ActionButton icon="solar:eye-linear" size="L" tooltip="Preview" onClick={() => onPreview(comp.id)} />
          <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
          <ActionButton icon="solar:menu-dots-bold" size="L" tooltip="More" ref={moreBtnRef} onClick={handleMoreClick} />
        </div>
        {showMenu && createPortal(
          <div style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}>
            <ComponentActionMenu
              comp={comp}
              onClose={() => setShowMenu(false)}
              onEdit={onEdit}
              onAuditLog={onAuditLog}
              onDuplicate={onDuplicate}
              onRequestDelete={onRequestDelete}
            />
          </div>,
          document.body
        )}
      </td>
    </tr>
  );
}

/* ── Preview Drawer with collapse/expand + refresh ── */
function PreviewDrawer({ comp, onClose }) {
  const [collapsed, setCollapsed] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const fullUrl = comp.domain && comp.url ? `https://${comp.domain}${comp.url}` : '';

  return (
    <Drawer title={`Preview — ${comp.name}`} onClose={onClose}>
      <div style={{ border: '0.5px solid var(--neutral-150)', borderRadius: 8, overflow: 'hidden' }}>
        {/* Collapsible header */}
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(c => !c)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
            width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit',
            border: 'none',
            borderBottom: collapsed ? 'none' : '0.5px solid var(--neutral-100)',
            background: 'var(--neutral-0)', cursor: 'pointer', userSelect: 'none',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--neutral-400)', flex: 1 }}>{comp.name}</span>
          <Badge variant="compliance-warn" label="External" />
          <Icon name={collapsed ? 'solar:alt-arrow-right-linear' : 'solar:alt-arrow-down-linear'} size={12} color="var(--neutral-200)" />
        </button>

        {!collapsed && (
          <>
            {fullUrl ? (
              <iframe
                key={iframeKey}
                src={fullUrl}
                title={comp.name}
                style={{ width: '100%', height: 400, border: 'none', display: 'block' }}
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <div style={{ height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--neutral-200)' }}>
                <Icon name="solar:widget-5-linear" size={32} color="var(--neutral-150)" />
                <div style={{ fontSize: 13 }}>No URL configured for this component</div>
              </div>
            )}
            {/* Footer with refresh */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 12px', borderTop: '0.5px solid var(--neutral-100)', fontSize: 11, color: 'var(--status-warning)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="solar:link-round-linear" size={12} color="var(--status-warning)" />
                External Content Provided by Your Org
              </div>
              <ActionButton icon="solar:refresh-linear" size="S" tooltip="Refresh preview" onClick={() => setIframeKey(k => k + 1)} />
            </div>
          </>
        )}
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--neutral-300)' }}>
        Domain: <code style={{ background: 'var(--neutral-50)', padding: '1px 4px', borderRadius: 3, fontSize: 11 }}>{comp.domain}</code>
        {' · '}Path: <code style={{ background: 'var(--neutral-50)', padding: '1px 4px', borderRadius: 3, fontSize: 11 }}>{comp.url}</code>
      </div>
    </Drawer>
  );
}

export function ComponentLibraryPanel({ searchQuery = '' }) {
  const showToast = useAppStore(s => s.showToast);
  const setComponentWizard = useAppStore(s => s.setComponentWizard);
  const components = useAppStore(s => s.embedComponents);
  const fetchEmbedComponents = useAppStore(s => s.fetchEmbedComponents);
  const toggleEmbedComponent = useAppStore(s => s.toggleEmbedComponent);
  const deleteEmbedComponent = useAppStore(s => s.deleteEmbedComponent);
  const duplicateEmbedComponent = useAppStore(s => s.duplicateEmbedComponent);

  const componentsLoading = useAppStore(s => s.embedComponentsLoading);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [auditDrawerEntity, setAuditDrawerEntity] = useState(null);
  const [previewComp, setPreviewComp] = useState(null);

  useEffect(() => { fetchEmbedComponents(); }, [fetchEmbedComponents]);

  const domains = DOMAINS;
  const removedDomains = domains.filter(d => d.status === 'removed');
  const affectedComponents = components.filter(c => c.domainRemoved);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return components;
    const q = searchQuery.toLowerCase().trim();
    return components.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.category?.toLowerCase().includes(q) ||
      c.domain?.toLowerCase().includes(q)
    );
  }, [components, searchQuery]);

  const handleToggle = async (id) => {
    const comp = components.find(c => c.id === id);
    await toggleEmbedComponent(id);
    if (comp) showToast(comp.enabled ? `"${comp.name}" disabled` : `"${comp.name}" enabled`);
  };

  const handleDuplicate = async (comp) => {
    const newComp = await duplicateEmbedComponent(comp.id);
    if (newComp) showToast(`"${comp.name}" duplicated`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteEmbedComponent(deleteTarget.id);
      showToast(`"${deleteTarget.name}" deleted`);
    } finally {
      setDeleting(false);
    }
    setDeleteTarget(null);
  };

  // Loading skeleton
  if (componentsLoading && components.length === 0) {
    return <div style={{ flex: 1, overflow: 'auto' }}><SimpleTableSkeleton rows={5} cols={6} /></div>;
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {/* Domain removed banner */}
      {affectedComponents.length > 0 && !warningDismissed && (
        <div style={{
          background: 'var(--status-warning-light)', borderBottom: '0.5px solid color-mix(in srgb, var(--status-warning) 20%, transparent)',
          padding: '10px 16px', display: 'flex', gap: 10, alignItems: 'center',
          fontSize: 12, lineHeight: 1.6, color: 'var(--status-warning)',
        }}>
          <Icon name="solar:danger-triangle-bold" size={16} color="var(--status-warning)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong>{removedDomains.length} domain{removedDomains.length !== 1 ? 's were' : ' was'} removed.</strong>{' '}
            {affectedComponents.length} component{affectedComponents.length !== 1 ? 's have' : ' has'} been disabled.{' '}
            <button
              type="button"
              style={{
                color: 'var(--status-warning)',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontWeight: 500,
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
              }}
              onClick={() => showToast('Navigate to Domain Registry to re-register')}
            >
              Re-register domain
            </button>
          </div>
          <CloseButton size={16} onClick={() => setWarningDismissed(true)} label="Dismiss warning" />
        </div>
      )}

      {/* Table — edge-to-edge */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Inter', sans-serif" }}>
        <thead>
          <tr>
            <th style={thStyle}>Component</th>
            <th style={thStyle}>Domain</th>
            <th style={thStyle}>Surfaces</th>
            <th style={thStyle}>Errors</th>
            <th style={thStyle}>Enabled</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 48 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--neutral-300)' }}>
                  <Icon name={searchQuery.trim() ? 'solar:magnifer-linear' : 'solar:widget-5-linear'} size={32} color="var(--neutral-150)" />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--neutral-400)' }}>
                      {searchQuery.trim() ? 'No results found' : 'No components configured yet'}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      {searchQuery.trim()
                        ? <>No components match "<strong>{searchQuery.trim()}</strong>".</>
                        : 'Register a domain first, then create your first embedded component.'}
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          )}
          {filtered.map(comp => (
            <ComponentRow
              key={comp.id}
              comp={comp}
              onToggle={handleToggle}
              onEdit={(id) => setComponentWizard(true, id)}
              onPreview={(id) => { const c = components.find(x => x.id === id); if (c) setPreviewComp(c); }}
              onAuditLog={(c) => setAuditDrawerEntity({ type: 'Component', name: c.name, domain: c.domain, id: c.id })}
              onDuplicate={handleDuplicate}
              onRequestDelete={setDeleteTarget}
            />
          ))}
        </tbody>
      </table>

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title={`Delete "${deleteTarget.name}"?`}
          description="This will permanently remove the component configuration. Providers will no longer see this component. This action cannot be undone."
          confirmLabel="Delete Component"
          variant="error"
          loading={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}

      {auditDrawerEntity && (
        <AuditLogDrawer entity={auditDrawerEntity} onClose={() => setAuditDrawerEntity(null)} />
      )}

      {/* Preview drawer */}
      {previewComp && (
        <PreviewDrawer comp={previewComp} onClose={() => setPreviewComp(null)} />
      )}
    </div>
  );
}
