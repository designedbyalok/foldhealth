import { useState, useMemo, useEffect, useId } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Switch } from '../../../components/Switch/Switch';
import { Input } from '../../../components/Input/Input';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Select } from '../../../components/Select/Select';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { SimpleTableSkeleton } from '../../../components/SimpleTableSkeleton/SimpleTableSkeleton';
import { useAppStore } from '../../../store/useAppStore';
import { DOMAIN_CATEGORIES, HIPAA_OPTIONS, COMPONENTS } from '../../../data/embeddedComponents';
import { AuditLogDrawer } from './AuditLogDrawer';
import { useTableSort } from '../../../components/HeaderCell/useTableSort';
import { HeaderCell } from '../../../components/HeaderCell/HeaderCell';

const thStyle = {
  textAlign: 'left', padding: '8px 16px', color: 'var(--neutral-300)', fontWeight: 500,
  fontSize: 12, whiteSpace: 'nowrap', borderBottom: '0.5px solid var(--neutral-150)',
  background: 'var(--neutral-0)', position: 'sticky', top: 0,
};
const tdStyle = { padding: '12px 16px', fontSize: 14, fontWeight: 400, color: 'var(--neutral-300)', verticalAlign: 'middle' };

const CATEGORY_BADGE_MAP = {
  'Internal': 'ai-care', 'Prior authorization': 'ai-care',
  'Analytics': 'compliance-warn', 'Care gaps / HEDIS': 'toc-engaged',
};
const HIPAA_BADGE_MAP = {
  'Verified': 'status-completed', 'BAA in place': 'status-completed',
  'Pending BAA': 'compliance-warn', 'Verify externally': 'ai-neutral',
};

function getComponentStats(domainId, components) {
  const comps = components.filter(c => c.domainId === domainId);
  const active = comps.filter(c => c.enabled).length;
  const disabled = comps.filter(c => !c.enabled).length;
  return { active, disabled, total: comps.length };
}

/* ── Form Field Wrapper ── */
const FORM_FIELD_LABEL_STYLE = { fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)' };

function FormField({ label, hint, controlId, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {controlId
        ? <label htmlFor={controlId} style={FORM_FIELD_LABEL_STYLE}>{label}</label>
        : <span style={FORM_FIELD_LABEL_STYLE}>{label}</span>}
      {children}
      {hint && <span style={{ fontSize: 11, color: hint.color || 'var(--neutral-200)' }}>{hint.text || hint}</span>}
    </div>
  );
}

/* ── Add Domain Drawer ── */
function AddDomainDrawer({ onClose, onSave }) {
  const uid = useId();
  const [form, setForm] = useState({ vendor: '', domain: '', category: DOMAIN_CATEGORIES[0], hipaa: HIPAA_OPTIONS[0] });

  const domainHint = useMemo(() => {
    const d = form.domain;
    if (d.includes('http')) return { text: 'Remove https:// — root domain only', color: 'var(--status-error)' };
    if (d.includes('/')) return { text: 'No paths — root domain only', color: 'var(--status-error)' };
    return { text: 'Root domain only — no https://, no paths', color: 'var(--neutral-200)' };
  }, [form.domain]);

  const canSave = form.vendor.trim() && form.domain.trim() && !form.domain.includes('http') && !form.domain.includes('/');

  return (
    <Drawer
      title="Register New Domain"
      onClose={onClose}
      headerRight={
        <Button variant="primary" size="L" disabled={!canSave} onClick={() => canSave && onSave(form)}>
          Register domain
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <FormField label={<>Vendor / label <span style={{ color: 'var(--status-error)' }}>*</span></>} controlId={`${uid}-vendor`}>
            <Input id={`${uid}-vendor`} placeholder="e.g. Availity" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} autoFocus />
          </FormField>
          <FormField label={<>Domain <span style={{ color: 'var(--status-error)' }}>*</span></>} hint={domainHint} controlId={`${uid}-domain`}>
            <Input id={`${uid}-domain`} placeholder="e.g. portal.availity.com" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} />
          </FormField>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <FormField label="Category" controlId={`${uid}-category`}>
            <Select
              id={`${uid}-category`}
              options={DOMAIN_CATEGORIES.map(c => ({ value: c, label: c }))}
              value={form.category}
              onChange={v => setForm(f => ({ ...f, category: v }))}
            />
          </FormField>
          <FormField label="HIPAA compliance" controlId={`${uid}-hipaa`}>
            <Select
              id={`${uid}-hipaa`}
              options={HIPAA_OPTIONS.map(h => ({ value: h, label: h }))}
              value={form.hipaa}
              onChange={v => setForm(f => ({ ...f, hipaa: v }))}
            />
          </FormField>
        </div>

        {/* Warning */}
        <div style={{
          display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 8,
          background: 'var(--status-warning-light)', border: '0.5px solid color-mix(in srgb, var(--status-warning) 20%, transparent)',
        }}>
          <Icon name="solar:shield-warning-linear" size={16} color="var(--status-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: 'var(--status-warning)', lineHeight: 1.5 }}>
            Patient context including patientId will be shared with iFrames on this domain. Only register domains from HIPAA-compliant vendors.
          </div>
        </div>
      </div>
    </Drawer>
  );
}

/* ── Edit Domain Drawer ── */
function EditDomainDrawer({ domain, onClose, onSave }) {
  const uid = useId();
  const [form, setForm] = useState({ vendor: domain.vendor, category: domain.category, hipaa: domain.hipaa });
  const canSave = form.vendor.trim();

  return (
    <Drawer
      title={`Edit — ${domain.domain}`}
      onClose={onClose}
      headerRight={
        <Button variant="primary" size="L" disabled={!canSave} onClick={() => canSave && onSave(form)}>
          Save changes
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <FormField label={<>Vendor / label <span style={{ color: 'var(--status-error)' }}>*</span></>} controlId={`${uid}-vendor`}>
            <Input id={`${uid}-vendor`} value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} autoFocus />
          </FormField>
          <FormField label="Domain (read-only)" controlId={`${uid}-domain`}>
            <Input id={`${uid}-domain`} value={domain.domain} disabled readOnly />
          </FormField>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <FormField label="Category" controlId={`${uid}-category`}>
            <Select
              id={`${uid}-category`}
              options={DOMAIN_CATEGORIES.map(c => ({ value: c, label: c }))}
              value={form.category}
              onChange={v => setForm(f => ({ ...f, category: v }))}
            />
          </FormField>
          <FormField label="HIPAA compliance" controlId={`${uid}-hipaa`}>
            <Select
              id={`${uid}-hipaa`}
              options={HIPAA_OPTIONS.map(h => ({ value: h, label: h }))}
              value={form.hipaa}
              onChange={v => setForm(f => ({ ...f, hipaa: v }))}
            />
          </FormField>
        </div>

        <div style={{
          display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 8,
          background: 'var(--status-warning-light)', border: '0.5px solid color-mix(in srgb, var(--status-warning) 20%, transparent)',
        }}>
          <Icon name="solar:info-circle-linear" size={16} color="var(--status-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: 'var(--status-warning)', lineHeight: 1.5 }}>
            Domain URL cannot be changed after registration. Delete and re-add to change the domain.
          </div>
        </div>
      </div>
    </Drawer>
  );
}

/* ── Main Panel ── */
export function DomainRegistryPanel({ searchQuery = '' }) {
  const showToast = useAppStore(s => s.showToast);
  const domains = useAppStore(s => s.embedDomains);
  const domainsLoading = useAppStore(s => s.embedDomainsLoading);
  const fetchEmbedDomains = useAppStore(s => s.fetchEmbedDomains);
  const addEmbedDomain = useAppStore(s => s.addEmbedDomain);
  const updateEmbedDomain = useAppStore(s => s.updateEmbedDomain);
  const deleteEmbedDomain = useAppStore(s => s.deleteEmbedDomain);
  const toggleEmbedDomain = useAppStore(s => s.toggleEmbedDomain);
  const embedComponents = useAppStore(s => s.embedComponents);

  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [editingDomain, setEditingDomain] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [infoDismissed, setInfoDismissed] = useState(false);
  const [auditDrawerEntity, setAuditDrawerEntity] = useState(null);

  useEffect(() => { fetchEmbedDomains(); }, [fetchEmbedDomains]);

  const domainAddTrigger = useAppStore(s => s.domainAddTrigger);
  const setDomainAddTrigger = useAppStore(s => s.setDomainAddTrigger);
  useEffect(() => {
    if (domainAddTrigger) { setShowAddDrawer(true); setDomainAddTrigger(false); }
  }, [domainAddTrigger, setDomainAddTrigger]);

  const filteredDomains = useMemo(() => {
    if (!searchQuery.trim()) return domains;
    const q = searchQuery.toLowerCase();
    return domains.filter(d => d.vendor?.toLowerCase().includes(q) || d.domain?.toLowerCase().includes(q));
  }, [domains, searchQuery]);
  const { sorted: filtered, sortKey: dSortKey, sortDir: dSortDir, requestSort: dRequestSort } = useTableSort(filteredDomains, 'vendor');

  const handleAdd = async (form) => {
    const d = await addEmbedDomain({ vendor: form.vendor, domain: form.domain, category: form.category, hipaa: form.hipaa, enabled: true, addedDate: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) });
    setShowAddDrawer(false);
    if (d) showToast(`Domain "${form.domain}" registered`);
  };

  const handleEdit = async (form) => {
    await updateEmbedDomain(editingDomain.id, { vendor: form.vendor, category: form.category, hipaa: form.hipaa });
    setEditingDomain(null);
    showToast(`Domain "${editingDomain.domain}" updated`);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const success = await deleteEmbedDomain(deleteTarget.id);
      if (success !== false) {
        showToast(`Domain "${deleteTarget.domain}" removed`);
      }
    } finally {
      setDeleting(false);
    }
    setDeleteTarget(null);
  };

  const handleToggle = async (id) => {
    const d = domains.find(d => d.id === id);
    await toggleEmbedDomain(id);
    if (d) showToast(d.enabled ? `Domain "${d.domain}" disabled` : `Domain "${d.domain}" enabled`);
  };

  // Loading skeleton
  if (domainsLoading && domains.length === 0) {
    return <SimpleTableSkeleton rows={4} cols={7} />;
  }

  return (
    <>
      {/* Info banner */}
      {!infoDismissed && (
        <div style={{
          display: 'flex', gap: 8, padding: '10px 16px', alignItems: 'center',
          background: 'var(--status-info-light)', borderBottom: '0.5px solid color-mix(in srgb, var(--status-info) 30%, transparent)',
        }}>
          <Icon name="solar:info-circle-linear" size={16} color="var(--status-info)" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 12, color: 'var(--status-info)', lineHeight: 1.5, flex: 1 }}>
            Domains are account-scoped. Only URLs from registered domains can be used when configuring components.
          </div>
          <CloseButton size={16} onClick={() => setInfoDismissed(true)} label="Dismiss info banner" />
        </div>
      )}

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Inter', sans-serif" }}>
        <thead>
          <tr>
            <HeaderCell label="Vendor / label" sortField="vendor" activeKey={dSortKey} activeDir={dSortDir} onSort={dRequestSort} style={thStyle} />
            <HeaderCell label="Domain" sortField="domain" activeKey={dSortKey} activeDir={dSortDir} onSort={dRequestSort} style={thStyle} />
            <HeaderCell label="Category" sortField="category" activeKey={dSortKey} activeDir={dSortDir} onSort={dRequestSort} style={thStyle} />
            <HeaderCell label="HIPAA" sortField="hipaa" activeKey={dSortKey} activeDir={dSortDir} onSort={dRequestSort} style={thStyle} />
            <th style={thStyle}>Components</th>
            <th style={thStyle}>Enabled</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: 48 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--neutral-300)' }}>
                  <Icon name="solar:global-linear" size={32} color="var(--neutral-150)" />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--neutral-400)' }}>No domains found</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      {searchQuery.trim() ? 'Try adjusting your search.' : 'Register your first domain to start configuring embedded components.'}
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          )}
          {filtered.map((d, idx) => {
            const stats = getComponentStats(d.id, embedComponents);
            const isDisabled = !d.enabled;
            const isFirst = idx === 0;
            return (
              <tr key={d.id}
                style={{ borderBottom: '0.5px solid var(--neutral-100)', transition: 'background .1s', ...(isDisabled ? { opacity: 0.55 } : {}) }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--primary-25)'}
                onMouseOut={e => e.currentTarget.style.background = ''}
              >
                <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--neutral-400)' }}>{d.vendor}</td>
                <td style={tdStyle}>
                  <code style={{ background: 'var(--neutral-50)', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontFamily: "'SF Mono', monospace", color: 'var(--neutral-400)' }}>{d.domain}</code>
                </td>
                <td style={tdStyle}><Badge variant={CATEGORY_BADGE_MAP[d.category] || 'ai-neutral'} label={d.category} /></td>
                <td style={tdStyle}><Badge variant={HIPAA_BADGE_MAP[d.hipaa] || 'ai-neutral'} label={d.hipaa} /></td>
                <td style={tdStyle}>
                  {stats.active > 0 && <Badge variant="status-completed" label={`${stats.active} active`} />}
                  {stats.active === 0 && stats.disabled === 0 && <Badge variant="status-queued" label="0 active" />}
                  {stats.disabled > 0 && <span style={{ marginLeft: stats.active > 0 ? 4 : 0 }}><Badge variant="status-failed" label={`${stats.disabled} disabled`} /></span>}
                </td>
                <td style={tdStyle} {...(isFirst ? { 'data-tour': 'embed-toggle' } : {})}><Switch checked={d.enabled !== false} onChange={() => handleToggle(d.id)} /></td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} {...(isFirst ? { 'data-tour': 'embed-actions' } : {})}>
                    <ActionButton icon="solar:pen-linear" size="L" tooltip="Edit" onClick={() => setEditingDomain(d)} />
                    <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
                    <ActionButton icon="solar:history-linear" size="L" tooltip="Audit Log" onClick={() => setAuditDrawerEntity({ type: 'Domain', name: d.vendor, domain: d.domain, id: d.id })} />
                    <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
                    <ActionButton icon="solar:trash-bin-minimalistic-linear" size="L" tooltip="Delete" onClick={() => setDeleteTarget(d)} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Drawers */}
      {showAddDrawer && <AddDomainDrawer onClose={() => setShowAddDrawer(false)} onSave={handleAdd} />}
      {editingDomain && <EditDomainDrawer domain={editingDomain} onClose={() => setEditingDomain(null)} onSave={handleEdit} />}

      {/* Delete confirmation (stays as modal) */}
      {deleteTarget && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title={`Remove "${deleteTarget.domain}"?`}
          description={`This will remove the domain from the registry. Any components using this domain will be auto-disabled.`}
          confirmLabel={deleting ? 'Removing...' : 'Remove domain'}
          variant="error"
          loading={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}

      {/* Audit log drawer */}
      {auditDrawerEntity && <AuditLogDrawer entity={auditDrawerEntity} onClose={() => setAuditDrawerEntity(null)} />}
    </>
  );
}
