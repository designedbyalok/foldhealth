import { useState, useMemo, useId, cloneElement, isValidElement } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Switch } from '../../../components/Switch/Switch';
import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { useAppStore } from '../../../store/useAppStore';
import {
  DOMAINS, COMPONENTS, COMPONENT_CATEGORIES, ICON_OPTIONS, VISIBILITY_OPTIONS,
  ACTIVATION_OPTIONS, CONDITION_OPTIONS, TOKEN_LIFETIME_OPTIONS, CONTEXT_FIELDS,
  WEB_PLACEMENT_OPTIONS, SIDECAR_PATIENT_PLACEMENTS, SIDECAR_GLOBAL_PLACEMENTS,
  MOBILE_PLACEMENTS, DRAWER_TAB_OPTIONS, ACTION_MENU_LOCATIONS, WORKLIST_OPTIONS,
  TAB_WIDGETS,
} from '../../../data/embeddedComponents';
import s from './EmbeddedComponents.module.css';
import g from './GoalsPanel.module.css';

const STEPS = ['Configure', 'Surfaces', 'Preview'];

/* ── Placement SVG Thumbnails ── */
function P360TabSvg() {
  return (
    <svg width="52" height="38" viewBox="0 0 52 38">
      <rect width="52" height="38" fill="#F7F5FC" />
      <rect x="2" y="3" width="48" height="6" rx="2" fill="white" />
      <rect x="3" y="4" width="11" height="4" rx="1.5" fill="#D1C4E9" />
      <rect x="16" y="4" width="11" height="4" rx="1.5" fill="#D1C4E9" />
      <rect x="29" y="4" width="13" height="4" rx="1.5" fill="#8C5AE2" />
      <rect x="2" y="11" width="48" height="25" rx="2" fill="white" />
    </svg>
  );
}
function SideDrawerSvg() {
  return (
    <svg width="52" height="38" viewBox="0 0 52 38">
      <rect width="52" height="38" fill="#F7F5FC" />
      <rect x="2" y="2" width="30" height="34" rx="2" fill="white" opacity=".5" />
      <rect x="32" y="2" width="18" height="34" rx="2" fill="#F5F0FF" />
      <rect x="34" y="5" width="13" height="2" rx="1" fill="#8C5AE2" />
      <rect x="34" y="9" width="9" height="2" rx="1" fill="#D7C0FF" opacity=".5" />
      <rect x="34" y="13" width="12" height="10" rx="2" fill="white" />
    </svg>
  );
}
function WidgetCardSvg() {
  return (
    <svg width="52" height="38" viewBox="0 0 52 38">
      <rect width="52" height="38" fill="#F7F5FC" />
      <rect x="2" y="2" width="32" height="34" rx="2" fill="white" opacity=".4" />
      <rect x="35" y="2" width="15" height="34" rx="2" fill="white" />
      <rect x="36" y="4" width="12" height="4" rx="1.5" fill="#F5F0FF" />
      <rect x="36" y="10" width="12" height="12" rx="2" fill="#8C5AE2" opacity=".12" />
      <rect x="37" y="12" width="7" height="2" rx="1" fill="#8C5AE2" opacity=".5" />
    </svg>
  );
}
function ActionMenuSvg() {
  return (
    <svg width="52" height="38" viewBox="0 0 52 38">
      <rect width="52" height="38" fill="#F7F5FC" />
      <rect x="2" y="2" width="48" height="8" rx="2" fill="white" opacity=".5" />
      <rect x="22" y="12" width="28" height="22" rx="3" fill="white" />
      <rect x="24" y="15" width="16" height="2.5" rx="1" fill="#D1C4E9" />
      <rect x="24" y="19.5" width="16" height="2.5" rx="1" fill="#8C5AE2" opacity=".7" />
      <rect x="24" y="24" width="16" height="2.5" rx="1" fill="#D1C4E9" />
    </svg>
  );
}

const WEB_SVG_MAP = {
  'p360-tab': P360TabSvg,
  'side-drawer': SideDrawerSvg,
  'widget-card': WidgetCardSvg,
  'action-menu': ActionMenuSvg,
};

/* ── Stepper (reuses Goal Wizard CSS classes from GoalsPanel.module.css) ── */
function Stepper({ step, onStepClick }) {
  return (
    <div className={g.stepper}>
      {STEPS.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <div key={label} style={{ display: 'contents' }}>
            <div
              className={`${g.wizStep} ${current ? g.wizStepActive : done ? g.wizStepDone : ''}`}
              onClick={() => i < step && onStepClick(i)}
              style={{ cursor: i < step ? 'pointer' : 'default' }}
            >
              <div className={g.wizStepNum}>{done ? <Icon name="solar:check-read-linear" size={12} /> : i + 1}</div>
              <span className={g.wizStepLabel}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`${g.wizConnector} ${done ? g.wizConnectorDone : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Reusable form field wrapper ── */
function FormField({ label, hint, children, style }) {
  const controlId = useId();
  const single = isValidElement(children);
  const control = single && !children.props.id
    ? cloneElement(children, { id: controlId })
    : children;
  const labelFor = single ? (children.props.id || controlId) : undefined;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      {labelFor
        ? <label className={s.label} htmlFor={labelFor}>{label}</label>
        : <span className={s.label}>{label}</span>}
      {control}
      {hint && <span className={s.hint}>{hint}</span>}
    </div>
  );
}

/* ── Step 1: Identity ── */
function StepIdentity({ data, onChange }) {
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Component name *">
          <Input value={data.name} onChange={e => onChange({ name: e.target.value })} placeholder="e.g. Prior Auth Widget" />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Category">
            <Select
              options={COMPONENT_CATEGORIES.map(c => ({ value: c, label: c }))}
              value={data.category}
              onChange={v => onChange({ category: v })}
            />
          </FormField>
          <FormField label="Visible to">
            <Select
              options={VISIBILITY_OPTIONS.map(v => ({ value: v, label: v }))}
              value={data.visibleTo}
              onChange={v => onChange({ visibleTo: v })}
            />
          </FormField>
        </div>
        <FormField label={<>Description <span style={{ fontWeight: 400, color: 'var(--neutral-200)' }}>(shown to providers in About popup)</span></>} hint={`${data.description.length}/200`}>
          <textarea className={s.textarea} value={data.description} onChange={e => onChange({ description: e.target.value.slice(0, 200) })} maxLength={200} placeholder="What does this component do?" />
        </FormField>
        <FormField label="Activation">
          <Select
            options={ACTIVATION_OPTIONS.map(a => ({ value: a.value, label: a.label }))}
            value={data.activation}
            onChange={v => onChange({ activation: v })}
          />
        </FormField>
      </div>
      {data.activation === 'conditional' && (
        <div style={{ marginTop: 10 }}>
          <div className={s.infoBox} style={{ background: 'var(--primary-50)', color: 'var(--primary-400)', border: '0.5px solid rgba(140,90,226,.15)' }}>
            Component surfaces only when the selected condition is true — prevents irrelevant components from cluttering the provider view.
          </div>
          <FormField label="Show when">
            <Select
              options={CONDITION_OPTIONS.map(c => ({ value: c, label: c }))}
              value={data.condition}
              onChange={v => onChange({ condition: v })}
            />
          </FormField>
        </div>
      )}
    </div>
  );
}

/* ── Widget Order List (sortable list for widget-card placement) ── */
function WidgetOrderList({ tab, newWidgetName, order, onChange }) {
  const existing = TAB_WIDGETS[tab] || [];
  const items = order || [...existing, newWidgetName];
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  // Initialize order if not set
  if (!order && existing.length > 0) {
    setTimeout(() => onChange([...existing, newWidgetName]), 0);
  }

  const handleDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
    requestAnimationFrame(() => { if (e.target) e.target.style.opacity = '0.4'; });
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overIdx !== idx) setOverIdx(idx);
  };

  const handleDrop = (e, toIdx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === toIdx) return;
    const next = [...items];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(toIdx, 0, moved);
    onChange(next);
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#6F7A90', marginBottom: 6 }}>{tab}</div>
      <div style={{ border: '0.5px solid var(--neutral-150)', borderRadius: 8, overflow: 'hidden' }}>
        {items.map((item, i) => {
          const isNew = item === newWidgetName && i === items.indexOf(newWidgetName);
          const isDragging = dragIdx === i;
          const isDropTarget = overIdx === i && dragIdx !== null && dragIdx !== i;
          return (
            <div
              key={`${item}-${i}`}
              draggable
              onDragStart={e => handleDragStart(e, i)}
              onDragEnd={handleDragEnd}
              onDragOver={e => handleDragOver(e, i)}
              onDragLeave={() => { if (overIdx === i) setOverIdx(null); }}
              onDrop={e => handleDrop(e, i)}
              onMouseOver={e => { if (!isDragging && !isDropTarget && !isNew) e.currentTarget.style.background = 'var(--neutral-50)'; }}
              onMouseOut={e => { if (!isDragging && !isDropTarget && !isNew) e.currentTarget.style.background = '#fff'; }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                borderBottomWidth: isDropTarget && dragIdx < i ? 2 : 0.5,
                borderBottomStyle: 'solid',
                borderBottomColor: isDropTarget && dragIdx < i ? 'var(--primary-300)' : 'var(--neutral-150)',
                background: isDropTarget ? 'var(--primary-25)' : isNew ? 'var(--primary-50)' : '#fff',
                borderTopWidth: isDropTarget && dragIdx > i ? 2 : 0,
                borderTopStyle: 'solid',
                borderTopColor: isDropTarget && dragIdx > i ? 'var(--primary-300)' : 'transparent',
                transition: 'background .1s',
                cursor: 'grab',
                opacity: isDragging ? 0.4 : 1,
                userSelect: 'none',
              }}
            >
              <span style={{ color: 'var(--neutral-200)', fontSize: 14, flexShrink: 0 }}>⋮⋮</span>
              <span style={{ flex: 1, fontSize: 14, color: isNew ? 'var(--primary-300)' : '#3A485F', fontWeight: isNew ? 500 : 400 }}>{item}</span>
              {isNew && (
                <span style={{
                  fontSize: 11, fontWeight: 500, color: 'var(--primary-300)',
                  background: 'var(--primary-100)', padding: '2px 6px', borderRadius: 4,
                }}>New Widget</span>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--neutral-200)', marginTop: 4 }}>
        Drag to reorder. Your widget will appear at position {(items.indexOf(newWidgetName) + 1) || items.length}.
      </div>
    </div>
  );
}

/* ── Step 2: Surfaces & Placement ── */
const WIZARD_SURFACES = [
  { key: 'web', icon: 'solar:monitor-linear', name: 'Fold Web', desc: 'Patient 360, side-drawer, worklists' },
  { key: 'sidecar', icon: 'solar:link-round-linear', name: 'Sidecar', desc: 'EHR overlay - patient + global views' },
  { key: 'mobile', icon: 'solar:smartphone-linear', name: 'Mobile app', desc: 'iOS / Android provider app' },
];

function StepSurfaces({ data, onChange }) {
  const toggleSurface = (key) => {
    const surfaces = data.surfaces.includes(key) ? data.surfaces.filter(s2 => s2 !== key) : [...data.surfaces, key];
    onChange({ surfaces });
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
        Select surfaces <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--neutral-300)' }}>(multi-select)</span>
      </div>
      <div className={s.surfaceGrid}>
        {WIZARD_SURFACES.map(sf => {
          const active = data.surfaces.includes(sf.key);
          return (
            <div key={sf.key} className={active ? s.surfaceCardActive : s.surfaceCard} onClick={() => toggleSurface(sf.key)}>
              <div className={s.surfaceIcon}><Icon name={sf.icon} size={18} color="var(--primary-300)" /></div>
              <div className={s.surfaceInfo}>
                <div className={s.surfaceName}>{sf.name}</div>
                <div className={s.surfaceDesc}>{sf.desc}</div>
              </div>
              <div className={s.surfaceCheck}>{active ? '✓' : ''}</div>
            </div>
          );
        })}
      </div>

      {/* Fold Web config */}
      {data.surfaces.includes('web') && (
        <div className={s.configSection}>
          <div className={s.configHeader}>
            <div className={s.configHeaderIcon}><Icon name="solar:monitor-linear" size={14} color="var(--primary-300)" /></div>
            Fold Web — Placement type
          </div>
          <div className={s.configBody}>
            <div className={s.placementGrid}>
              {WEB_PLACEMENT_OPTIONS.map(pl => {
                const SvgComp = WEB_SVG_MAP[pl.value];
                const active = data.webPlacement === pl.value;
                return (
                  <div key={pl.value} className={active ? s.placementCardActive : s.placementCard} onClick={() => onChange({ webPlacement: pl.value })}>
                    {SvgComp && <SvgComp />}
                    <div className={s.placementLabel}>{pl.label}</div>
                    <div className={s.placementDesc}>{pl.description}</div>
                  </div>
                );
              })}
            </div>
            {/* Side-drawer config */}
            {data.webPlacement === 'side-drawer' && (
              <div className={s.modalGrid} style={{ gap: 12 }}>
                <div className={s.formGroup}>
                  <label className={s.label} htmlFor="cw-drawer-width">Drawer width</label>
                  <div className={s.sliderRow}>
                    <input id="cw-drawer-width" type="range" min={300} max={800} step={10} value={data.drawerWidth}
                      className={s.sliderRange}
                      onChange={e => onChange({ drawerWidth: Number(e.target.value) })} />
                    <span className={s.sliderValue}>{data.drawerWidth}px</span>
                  </div>
                  <div className={s.sliderBar}>
                    <div className={`${s.sliderFill} ${data.drawerWidth > 650 ? s.sliderRed : data.drawerWidth > 500 ? s.sliderAmber : s.sliderGreen}`}
                      style={{ width: `${Math.round((data.drawerWidth - 300) / 500 * 100)}%` }} />
                  </div>
                  <span className={s.hint}>
                    {data.drawerWidth > 650 ? 'Warning: will significantly overlap the patient chart' : data.drawerWidth > 500 ? 'Caution: may overlap chart on screens under 1280px' : 'Safe — fits alongside patient chart on 1280px+ screens'}
                  </span>
                </div>
                <FormField label="Opens via">
                  <Select
                    options={['Action menu item only', 'Nav tab + action menu', 'Inline button (e.g. in gap list)'].map(o => ({ value: o, label: o }))}
                    value={data.opensVia}
                    onChange={v => onChange({ opensVia: v })}
                  />
                </FormField>
                <FormField label="Show in tab context">
                  <Select
                    options={['All patient tabs', 'Gaps tab only', 'Orders tab only', 'Care Programs tab'].map(o => ({ value: o, label: o }))}
                    value={data.tabContext}
                    onChange={v => onChange({ tabContext: v })}
                  />
                </FormField>
                <FormField label="Background behavior">
                  <Select
                    options={['Dim patient chart', 'No dim'].map(o => ({ value: o, label: o }))}
                    value={data.background}
                    onChange={v => onChange({ background: v })}
                  />
                </FormField>
              </div>
            )}
            {/* P360 tab config */}
            {data.webPlacement === 'p360-tab' && (
              <div className={s.formGroup}>
                <label className={s.label} htmlFor="cw-web-tab-label">Tab label</label>
                <Input id="cw-web-tab-label" style={{ maxWidth: 220 }} value={data.webTabLabel} onChange={e => onChange({ webTabLabel: e.target.value })} />
              </div>
            )}
            {/* Widget card config */}
            {data.webPlacement === 'widget-card' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FormField label="Display in drawer tab" hint="Widget appears as a card within this tab">
                    <Select
                      options={DRAWER_TAB_OPTIONS.map(t => ({ value: t, label: t }))}
                      value={data.drawerTab}
                      onChange={v => onChange({ drawerTab: v, widgetOrder: null })}
                    />
                  </FormField>
                  <FormField label="Widget height">
                    <Select
                      options={['Auto (up to 280px)', 'Fixed 200px', 'Fixed 300px'].map(o => ({ value: o, label: o }))}
                      value={data.widgetHeight}
                      onChange={v => onChange({ widgetHeight: v })}
                    />
                  </FormField>
                </div>

                {/* Widget ordering — show existing widgets in the selected tab */}
                {data.drawerTab && (TAB_WIDGETS[data.drawerTab] || []).length > 0 && (
                  <WidgetOrderList
                    tab={data.drawerTab}
                    newWidgetName={data.name || 'New Widget'}
                    order={data.widgetOrder}
                    onChange={order => onChange({ widgetOrder: order })}
                  />
                )}
              </div>
            )}
            {/* Action menu config */}
            {data.webPlacement === 'action-menu' && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)', marginBottom: 8 }}>Apply to which action menus?</div>
                <div className={s.modalGrid} style={{ gap: 6, marginBottom: 12 }}>
                  {ACTION_MENU_LOCATIONS.map(loc => {
                    const active = data.actionMenus?.includes(loc.key);
                    return (
                      <div key={loc.key} className={active ? s.checkItemActive : s.checkItem}
                        onClick={() => {
                          const menus = active ? data.actionMenus.filter(k => k !== loc.key) : [...(data.actionMenus || []), loc.key];
                          onChange({ actionMenus: menus });
                        }}>
                        <div className={s.checkBox}>{active ? '✓' : ''}</div>
                        {loc.label}
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)', marginBottom: 6 }}>Worklists</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {WORKLIST_OPTIONS.map(wl => {
                    const active = data.worklists?.includes(wl);
                    return (
                      <div key={wl} className={active ? s.wlPillActive : s.wlPill}
                        onClick={() => {
                          const wls = active ? data.worklists.filter(w => w !== wl) : [...(data.worklists || []), wl];
                          onChange({ worklists: wls });
                        }}>
                        {wl}
                      </div>
                    );
                  })}
                </div>
                <FormField label="Action triggers">
                  <Select
                    options={['Opens a drawer on the right', 'Opens full-screen view'].map(o => ({ value: o, label: o }))}
                    value={data.actionTrigger}
                    onChange={v => onChange({ actionTrigger: v })}
                  />
                </FormField>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sidecar config */}
      {data.surfaces.includes('sidecar') && (
        <div className={s.configSection}>
          <div className={s.configHeader}>
            <div className={s.configHeaderIcon}><Icon name="solar:link-round-linear" size={14} color="var(--primary-300)" /></div>
            Sidecar — Placement
          </div>
          <div className={s.configBody}>
            <div className={s.subTabs}>
              <div className={data.sidecarView === 'patient' ? s.subTabActive : s.subTab} onClick={() => onChange({ sidecarView: 'patient' })}>Patient context view</div>
              <div className={data.sidecarView === 'global' ? s.subTabActive : s.subTab} onClick={() => onChange({ sidecarView: 'global' })}>Global view (no patient)</div>
            </div>
            {data.sidecarView === 'patient' ? (
              <>
                <div className={s.infoBlue} style={{ marginBottom: 10 }}>Active when a provider has opened a patient in the EHR. Full JWT with patientId available.</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  {SIDECAR_PATIENT_PLACEMENTS.map(pl => {
                    const active = data.sidecarPlacement === pl.value;
                    return (
                      <div key={pl.value} className={active ? s.checkItemActive : s.checkItem}
                        style={{ padding: 12, borderRadius: 8, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}
                        onClick={() => onChange({ sidecarPlacement: pl.value })}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{pl.label}</div>
                        <div style={{ fontSize: 11, opacity: .7 }}>{pl.description}</div>
                      </div>
                    );
                  })}
                </div>
                {data.sidecarPlacement === 'tab' && (
                  <div className={s.formGroup}>
                    <label className={s.label} htmlFor="cw-sidecar-tab-label">Tab label in Sidecar</label>
                    <Input id="cw-sidecar-tab-label" style={{ maxWidth: 200 }} value={data.sidecarTabLabel} onChange={e => onChange({ sidecarTabLabel: e.target.value })} />
                  </div>
                )}
                {data.sidecarPlacement === 'widget' && (
                  <FormField label="Display in existing tab" hint="Widget appears as a collapsible card within this tab">
                    <Select
                      options={DRAWER_TAB_OPTIONS.map(t => ({ value: t, label: t }))}
                      value={data.sidecarWidgetTab}
                      onChange={v => onChange({ sidecarWidgetTab: v })}
                    />
                  </FormField>
                )}
              </>
            ) : (
              <>
                <div className={s.infoAmber} style={{ marginBottom: 10 }}>No patient context available. JWT contains only userId and accountId. Suitable for account-level dashboards or task notifications only.</div>
                <FormField label="Placement in global view">
                  <Select
                    options={SIDECAR_GLOBAL_PLACEMENTS.map(p => ({ value: p, label: p }))}
                    value={data.sidecarGlobalPlacement}
                    onChange={v => onChange({ sidecarGlobalPlacement: v })}
                  />
                </FormField>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile config */}
      {data.surfaces.includes('mobile') && (
        <div className={s.configSection}>
          <div className={s.configHeader}>
            <div className={s.configHeaderIcon}><Icon name="solar:smartphone-linear" size={14} color="var(--primary-300)" /></div>
            Mobile app — Placement
          </div>
          <div className={s.configBody}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              {MOBILE_PLACEMENTS.map(pl => {
                const active = data.mobilePlacement === pl.value;
                return (
                  <div key={pl.value} className={active ? s.checkItemActive : s.checkItem}
                    style={{ padding: 12, borderRadius: 8, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}
                    onClick={() => onChange({ mobilePlacement: pl.value })}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{pl.label}</div>
                    <div style={{ fontSize: 11, opacity: .7 }}>{pl.description}</div>
                  </div>
                );
              })}
            </div>
            {data.mobilePlacement === 'profile-tab' && (
              <div className={s.formGroup}>
                <label className={s.label} htmlFor="cw-mobile-tab-label">Tab label on mobile</label>
                <Input id="cw-mobile-tab-label" style={{ maxWidth: 200 }} value={data.mobileTabLabel} onChange={e => onChange({ mobileTabLabel: e.target.value })} />
              </div>
            )}
            {data.mobilePlacement === 'home-card' && (
              <div className={s.infoAmber}>Home screen components receive only userId and accountId. Not suitable for patient-specific tools.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Step 3: Context & Security ── */
function StepContext({ data, onChange }) {
  const activeDomains = DOMAINS.filter(d => d.status === 'active');
  const selectedDomain = activeDomains.find(d => d.id === data.domainId);
  const fullUrl = selectedDomain ? `https://${selectedDomain.domain}${data.url}` : '';
  const selectedFieldCount = data.contextFields.length;
  const totalFieldCount = CONTEXT_FIELDS.length;

  return (
    <div style={{ maxWidth: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <FormField label="Domain *">
          <Select
            options={activeDomains.map(d => ({ value: String(d.id), label: d.domain }))}
            value={String(data.domainId)}
            onChange={v => onChange({ domainId: Number(v) })}
          />
        </FormField>
        <FormField label="Path *" hint={fullUrl ? `Full URL: ${fullUrl}` : undefined}>
          <Input value={data.url} onChange={e => onChange({ url: e.target.value })} placeholder="/widget/..." />
        </FormField>
        <FormField label="Test / staging URL" hint="Used in preview mode — no real patient data">
          <Input value={data.stagingUrl} onChange={e => onChange({ stagingUrl: e.target.value })} placeholder="/widget/...?env=staging" />
        </FormField>
        <FormField label="Token lifetime" hint={data.tokenLifetime === 30 ? 'Use 30 min for complex workflows like prior auth' : undefined}>
          <Select
            options={TOKEN_LIFETIME_OPTIONS.map(t => ({ value: String(t.value), label: t.label }))}
            value={String(data.tokenLifetime)}
            onChange={v => onChange({ tokenLifetime: Number(v) })}
          />
        </FormField>
      </div>

      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)', marginBottom: 8 }}>
        JWT context scope — fields sent to this component
      </div>
      <div className={s.modalGrid} style={{ gap: 6, marginBottom: 16 }}>
        {CONTEXT_FIELDS.map(field => {
          const active = data.contextFields.includes(field.key);
          return (
            <div key={field.key}
              className={field.locked ? s.checkItemLocked : active ? s.checkItemActive : s.checkItem}
              onClick={() => {
                if (field.locked) return;
                const fields = active ? data.contextFields.filter(f => f !== field.key) : [...data.contextFields, field.key];
                onChange({ contextFields: fields });
              }}>
              <div className={s.checkBox}>{active ? '✓' : ''}</div>
              {field.label}{field.description ? ` — ${field.description}` : ''}
            </div>
          );
        })}
      </div>

      {/* Save Summary */}
      <div className={s.summaryCard}>
        <div className={s.summaryLabel}>Save Summary</div>
        <div className={s.summaryGrid}>
          <div className={s.summaryKey}>Name</div><div className={s.summaryVal}>{data.name || '—'}</div>
          <div className={s.summaryKey}>Surfaces</div><div className={s.summaryVal}>{data.surfaces.map(sf => sf === 'web' ? 'Fold Web' : sf === 'sidecar' ? 'Sidecar' : 'Mobile').join(' · ') || '—'}</div>
          <div className={s.summaryKey}>Placement</div>
          <div className={s.summaryVal}>
            {[data.webPlacement && WEB_PLACEMENT_OPTIONS.find(p => p.value === data.webPlacement)?.label,
              data.sidecarPlacement && `Sidecar ${data.sidecarPlacement}`,
              data.mobilePlacement && MOBILE_PLACEMENTS.find(p => p.value === data.mobilePlacement)?.label,
            ].filter(Boolean).join(' · ') || '—'}
            {data.webPlacement === 'side-drawer' && data.drawerWidth ? ` (${data.drawerWidth}px)` : ''}
          </div>
          <div className={s.summaryKey}>URL</div>
          <div className={s.summaryVal} style={{ fontFamily: "'SF Mono', monospace", fontSize: 11 }}>{fullUrl || '—'}</div>
          <div className={s.summaryKey}>Token lifetime</div><div className={s.summaryVal}>{data.tokenLifetime} min</div>
          <div className={s.summaryKey}>Context scope</div><div className={s.summaryVal}>{selectedFieldCount} of {totalFieldCount} fields</div>
        </div>
        <div className={s.infoAmber} style={{ marginTop: 12, fontSize: 11 }}>
          Saved as disabled. Enable from the library after testing in preview mode.
        </div>
      </div>
    </div>
  );
}

/* ── Step: Configure (merged Identity + Context) ── */
function StepConfigure({ data, onChange, embedDomains }) {
  const activeDomains = (embedDomains && embedDomains.length > 0 ? embedDomains : DOMAINS).filter(d => d.enabled !== false && d.status !== 'removed');
  const selectedDomain = activeDomains.find(d => d.id === data.domainId);
  const fullUrl = selectedDomain ? `https://${selectedDomain.domain}${data.url}` : '';
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 1. Component Name */}
      <FormField label="Component name *">
        <Input value={data.name} onChange={e => onChange({ name: e.target.value })} placeholder="e.g. Prior Auth Widget" />
      </FormField>

      {/* 2. Description */}
      <FormField label={<>Description <span style={{ fontWeight: 400, color: 'var(--neutral-200)' }}>(shown to providers)</span></>} hint={`${data.description.length}/800`}>
        <textarea className={s.textarea} value={data.description} onChange={e => onChange({ description: e.target.value.slice(0, 800) })} maxLength={800} placeholder="What does this component do?" style={{ resize: 'vertical' }} />
      </FormField>

      {/* 3. Domain & Path */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <FormField label="Domain *">
          <Select
            options={activeDomains.map(d => ({ value: String(d.id), label: d.domain }))}
            value={String(data.domainId)}
            onChange={v => onChange({ domainId: Number(v) })}
          />
        </FormField>
        <FormField label="Path *" hint={fullUrl ? `${fullUrl}` : undefined}>
          <Input value={data.url} onChange={e => onChange({ url: e.target.value })} placeholder="/widget/..." />
        </FormField>
      </div>

      {/* 4. Category & Visible To */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <FormField label="Category">
          <Select
            options={COMPONENT_CATEGORIES.map(c => ({ value: c, label: c }))}
            value={data.category}
            onChange={v => onChange({ category: v })}
          />
        </FormField>
        <FormField label="Visible to">
          <Select
            options={VISIBILITY_OPTIONS.map(v => ({ value: v, label: v }))}
            value={data.visibleTo}
            onChange={v => onChange({ visibleTo: v })}
          />
        </FormField>
      </div>

      {/* 5. Additional Settings (collapsible) */}
      <div style={{ border: '0.5px solid var(--neutral-100)', borderRadius: 8, overflow: 'hidden' }}>
        <button
          onClick={() => setAdvancedOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px',
            background: 'var(--neutral-50)', border: 'none', cursor: 'pointer',
            fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 500, color: 'var(--neutral-400)',
          }}
        >
          <Icon name={advancedOpen ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'} size={14} color="#6F7A90" />
          Additional Settings
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--neutral-200)', marginLeft: 'auto' }}>
            {advancedOpen ? 'Collapse' : 'Expand'}
          </span>
        </button>
        {advancedOpen && (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Activation */}
            <FormField label="Activation">
              <Select
                options={ACTIVATION_OPTIONS.map(a => ({ value: a.value, label: a.label }))}
                value={data.activation}
                onChange={v => onChange({ activation: v })}
              />
            </FormField>
            {data.activation === 'conditional' && (
              <FormField label="Show when">
                <Select
                  options={CONDITION_OPTIONS.map(c => ({ value: c, label: c }))}
                  value={data.condition}
                  onChange={v => onChange({ condition: v })}
                />
              </FormField>
            )}

            {/* Token Lifetime */}
            <FormField label="Token lifetime" hint={data.tokenLifetime === 30 ? 'Use 30 min for complex workflows' : undefined}>
              <Select
                options={TOKEN_LIFETIME_OPTIONS.map(t => ({ value: String(t.value), label: t.label }))}
                value={String(data.tokenLifetime)}
                onChange={v => onChange({ tokenLifetime: Number(v) })}
              />
            </FormField>

            {/* JWT Context Scope */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#6F7A90', marginBottom: 6 }}>
                JWT context scope
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {CONTEXT_FIELDS.map(field => {
                  const active = data.contextFields.includes(field.key);
                  return (
                    <div key={field.key}
                      className={field.locked ? s.checkItemLocked : active ? s.checkItemActive : s.checkItem}
                      onClick={() => {
                        if (field.locked) return;
                        const fields = active ? data.contextFields.filter(f => f !== field.key) : [...data.contextFields, field.key];
                        onChange({ contextFields: fields });
                      }}>
                      <div className={s.checkBox}>{active ? '✓' : ''}</div>
                      {field.label}{field.description ? ` — ${field.description}` : ''}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Step: Preview ── */
function StepPreview({ data, onChange, embedDomains }) {
  const allDomains = (embedDomains && embedDomains.length > 0) ? embedDomains : DOMAINS;
  const selectedDomain = allDomains.find(d => d.id === data.domainId);
  const fullUrl = selectedDomain ? `https://${selectedDomain.domain}${data.url}` : '';
  const selectedFieldCount = data.contextFields.length;
  const totalFieldCount = CONTEXT_FIELDS.length;
  const [iframeLoading, setIframeLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const previewHeight = data.previewHeight || 280;

  const refreshIframe = () => { setIframeLoading(true); setIframeKey(k => k + 1); };

  return (
    <div>
      {/* ── Widget Preview (matching Figma node 239:24297) ── */}
      <div style={{ border: '0.5px solid var(--neutral-150)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
        {/* Widget header — collapsible */}
        <div
          onClick={() => setCollapsed(c => !c)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
            borderBottom: collapsed ? 'none' : '0.5px solid var(--neutral-100)',
            background: 'var(--neutral-0)', cursor: 'pointer', userSelect: 'none',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--neutral-400)', flex: 1 }}>{data.name || 'Widget'}</span>
          <Icon name={collapsed ? 'solar:alt-arrow-right-linear' : 'solar:alt-arrow-down-linear'} size={12} color="#8A94A8" />
        </div>

        {/* Collapsible content */}
        {!collapsed && (
          <>
            {/* iframe content */}
            {fullUrl ? (
              <div style={{ position: 'relative' }}>
                {iframeLoading && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: 'var(--neutral-0)', zIndex: 1,
                  }}>
                    <div style={{ width: 24, height: 24, border: '2px solid var(--neutral-100)', borderTopColor: 'var(--primary-300)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                    <span style={{ fontSize: 12, color: 'var(--neutral-200)' }}>Loading preview...</span>
                  </div>
                )}
                <iframe
                  key={iframeKey}
                  src={fullUrl}
                  title={data.name || 'Component preview'}
                  style={{ width: '100%', height: previewHeight, border: 'none', display: 'block' }}
                  sandbox="allow-scripts allow-same-origin"
                  onLoad={() => setIframeLoading(false)}
                />
              </div>
            ) : (
              <div style={{
                width: '100%', height: previewHeight,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'var(--neutral-50)', color: 'var(--neutral-200)',
              }}>
                <Icon name="solar:widget-5-linear" size={32} color="var(--neutral-200)" />
                <div style={{ fontSize: 13 }}>Select a domain and enter a path to see a live preview</div>
              </div>
            )}

            {/* External content footer with refresh action button */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 12px', borderTop: '0.5px solid var(--neutral-100)',
              background: 'var(--neutral-0)', fontSize: 11, color: 'var(--neutral-200)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="solar:link-round-linear" size={12} color="#D9A50B" />
                <span style={{ color: 'var(--status-warning)' }}>External Content Provided by Your Org</span>
              </div>
              <ActionButton icon="solar:refresh-linear" size="S" tooltip="Refresh preview" onClick={refreshIframe} />
            </div>
          </>
        )}
      </div>

      {/* Height control slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#6F7A90', whiteSpace: 'nowrap' }}>Widget height</span>
        <input
          aria-label="Widget height"
          type="range" min={150} max={600} step={10} value={previewHeight}
          onChange={e => onChange({ previewHeight: Number(e.target.value) })}
          style={{ width: '100%', height: 8, accentColor: 'var(--primary-300)', cursor: 'pointer', background: 'var(--neutral-100)', borderRadius: 4, border: 'none', outline: 'none', WebkitAppearance: 'none', MozAppearance: 'none' }}
        />
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--neutral-400)', minWidth: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{previewHeight}px</span>
      </div>

      {/* ── Save Summary ── */}
      <div className={s.summaryCard} style={{ marginBottom: 16 }}>
        <div className={s.summaryLabel}>Save Summary</div>
        <div className={s.summaryGrid}>
          <div className={s.summaryKey}>Name</div><div className={s.summaryVal}>{data.name || '—'}</div>
          <div className={s.summaryKey}>Surfaces</div><div className={s.summaryVal}>{data.surfaces.map(sf => sf === 'web' ? 'Fold Web' : sf === 'sidecar' ? 'Sidecar' : 'Mobile').join(' · ') || '—'}</div>
          <div className={s.summaryKey}>Placement</div>
          <div className={s.summaryVal}>
            {[data.webPlacement && WEB_PLACEMENT_OPTIONS.find(p => p.value === data.webPlacement)?.label,
              data.sidecarPlacement && `Sidecar ${data.sidecarPlacement}`,
              data.mobilePlacement && MOBILE_PLACEMENTS.find(p => p.value === data.mobilePlacement)?.label,
            ].filter(Boolean).join(' · ') || '—'}
          </div>
          <div className={s.summaryKey}>URL</div>
          <div className={s.summaryVal} style={{ fontFamily: "'SF Mono', monospace", fontSize: 11 }}>{fullUrl || '—'}</div>
          <div className={s.summaryKey}>Token lifetime</div><div className={s.summaryVal}>{data.tokenLifetime} min</div>
          <div className={s.summaryKey}>Context scope</div><div className={s.summaryVal}>{selectedFieldCount} of {totalFieldCount} fields</div>
        </div>
        {/* Info alert with warning styling */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '6px 10px',
          borderRadius: 6, background: 'var(--status-warning-light)',
          border: '0.5px solid rgba(217,165,11,.15)',
          fontSize: 11, color: 'var(--status-warning)',
        }}>
          <Icon name="solar:info-circle-linear" size={14} color="var(--status-warning)" style={{ flexShrink: 0 }} />
          Saved as disabled. Enable from the library after testing in preview mode.
        </div>
      </div>

      {/* ── Developer Console ── */}
      <div className={s.devConsole}>
        <div className={s.devConsoleHeader}>
          <span className={s.devConsoleTitle}>Developer Console</span>
          <Icon name="solar:alt-arrow-down-linear" size={12} color="rgba(255,255,255,.4)" />
        </div>
        <div className={s.devConsoleBody}>
          <div>{'{'}</div>
          <div>  <span className={s.devConsoleKey}>"patientId"</span>: <span className={s.devConsoleStr}>"mock-pt-001"</span>,</div>
          <div>  <span className={s.devConsoleKey}>"accountId"</span>: <span className={s.devConsoleStr}>"acct-fold-demo"</span>,</div>
          {data.contextFields.includes('userId') && <div>  <span className={s.devConsoleKey}>"userId"</span>: <span className={s.devConsoleStr}>"usr-dr-smith"</span>,</div>}
          {data.contextFields.includes('userEmail') && <div>  <span className={s.devConsoleKey}>"userEmail"</span>: <span className={s.devConsoleStr}>"dr.smith@fold.health"</span>,</div>}
          {data.contextFields.includes('screen') && <div>  <span className={s.devConsoleKey}>"screen"</span>: <span className={s.devConsoleStr}>"patient-360"</span>,</div>}
          {data.contextFields.includes('componentId') && <div>  <span className={s.devConsoleKey}>"componentId"</span>: <span className={s.devConsoleStr}>"comp-{data.name?.toLowerCase().replace(/\s/g, '-') || 'new'}"</span>,</div>}
          <div>  <span className={s.devConsoleKey}>"exp"</span>: {Date.now() + data.tokenLifetime * 60000}</div>
          <div>{'}'}</div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Wizard ── */
export function ComponentWizardDrawer() {
  const setComponentWizard = useAppStore(s => s.setComponentWizard);
  const editId = useAppStore(s => s.componentWizardEditId);
  const showToast = useAppStore(s => s.showToast);
  const addEmbedComponent = useAppStore(s => s.addEmbedComponent);
  const updateEmbedComponent = useAppStore(s => s.updateEmbedComponent);
  const embedDomains = useAppStore(s => s.embedDomains);
  const embedComponents = useAppStore(s => s.embedComponents);

  const existing = editId ? (embedComponents.find(c => c.id === editId) || COMPONENTS.find(c => c.id === editId)) : null;

  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    name: existing?.name || '',
    category: existing?.category || COMPONENT_CATEGORIES[0],
    icon: existing?.icon || '📋',
    description: existing?.description || '',
    visibleTo: existing?.visibleTo || VISIBILITY_OPTIONS[0],
    activation: existing?.activation || 'always',
    condition: existing?.condition || CONDITION_OPTIONS[0],
    surfaces: existing?.surfaces || [],
    webPlacement: existing?.placements?.web || 'side-drawer',
    drawerWidth: existing?.webConfig?.drawerWidth || 480,
    opensVia: existing?.webConfig?.opensVia || 'Action menu item only',
    tabContext: existing?.webConfig?.tabContext || 'All patient tabs',
    background: existing?.webConfig?.background || 'Dim patient chart',
    webTabLabel: existing?.webConfig?.tabLabel || '',
    drawerTab: existing?.webConfig?.drawerTab || 'Gaps',
    widgetHeight: existing?.webConfig?.widgetHeight || 'Auto (up to 280px)',
    actionMenus: existing?.webConfig?.actionMenus || [],
    worklists: existing?.webConfig?.worklists || [],
    actionTrigger: existing?.webConfig?.actionTrigger || 'Opens a drawer on the right',
    sidecarView: 'patient',
    sidecarPlacement: existing?.sidecarConfig?.placement || 'tab',
    sidecarTabLabel: existing?.sidecarConfig?.tabLabel || '',
    sidecarWidgetTab: 'Gaps',
    sidecarGlobalPlacement: SIDECAR_GLOBAL_PLACEMENTS[0],
    mobilePlacement: existing?.placements?.mobile || 'profile-tab',
    mobileTabLabel: '',
    domainId: existing?.domainId || DOMAINS.find(d => d.status === 'active')?.id || 1,
    url: existing?.url || '',
    stagingUrl: existing?.stagingUrl || '',
    tokenLifetime: existing?.tokenLifetime || 5,
    contextFields: existing?.contextFields || ['patientId', 'accountId', 'userId', 'userEmail', 'screen', 'componentId'],
  });

  const update = (patch) => setData(prev => ({ ...prev, ...patch }));
  const close = () => setComponentWizard(false, null);

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const selectedDomain = (embedDomains.length > 0 ? embedDomains : DOMAINS).find(d => d.id === data.domainId);
    const compData = {
      name: data.name,
      category: data.category,
      description: data.description,
      domainId: data.domainId,
      domain: selectedDomain?.domain || '',
      surfaces: data.surfaces,
      placements: {
        ...(data.surfaces.includes('web') ? { web: data.webPlacement } : {}),
        ...(data.surfaces.includes('sidecar') ? { sidecar: data.sidecarPlacement } : {}),
        ...(data.surfaces.includes('mobile') ? { mobile: data.mobilePlacement } : {}),
      },
      webConfig: {
        drawerWidth: data.drawerWidth,
        opensVia: data.opensVia,
        tabContext: data.tabContext,
        background: data.background,
        tabLabel: data.webTabLabel,
        drawerTab: data.drawerTab,
        widgetHeight: data.widgetHeight,
        widgetOrder: data.widgetOrder,
        actionMenus: data.actionMenus,
        worklists: data.worklists,
        actionTrigger: data.actionTrigger,
      },
      sidecarConfig: { placement: data.sidecarPlacement, tabLabel: data.sidecarTabLabel, widgetTab: data.sidecarWidgetTab, globalPlacement: data.sidecarGlobalPlacement },
      mobileConfig: { placement: data.mobilePlacement, tabLabel: data.mobileTabLabel },
      url: data.url,
      stagingUrl: data.stagingUrl || '',
      tokenLifetime: data.tokenLifetime,
      contextFields: data.contextFields,
      visibleTo: data.visibleTo,
      activation: data.activation,
      condition: data.condition,
      enabled: false,
      previewed: false,
    };

    try {
      if (editId) {
        await updateEmbedComponent(editId, compData);
        showToast(`"${data.name}" updated`);
      } else {
        const result = await addEmbedComponent(compData);
        if (result) {
          showToast(`"${data.name}" created (disabled)`);
        } else {
          showToast('Failed to save component. Check console for details.');
          return;
        }
      }
      close();
    } catch (err) {
      console.error('[ComponentWizard] Save failed:', err);
      showToast(`Save failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const canNext = step === 0 ? (data.name.trim().length > 0 && data.domainId > 0) : step === 1 ? data.surfaces.length > 0 : true;

  const headerRight = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Button variant="primary" size="L" disabled={!canNext || saving} onClick={() => {
        if (step < STEPS.length - 1) setStep(step + 1);
        else handleSave();
      }}>
        {saving ? 'Saving...' : step === STEPS.length - 1 ? (editId ? 'Save Changes' : 'Save & Enable') : 'Next'}
      </Button>
    </div>
  );

  return (
    <Drawer
      title={editId ? `Edit — ${data.name}` : 'New Component'}
      onClose={close}
      headerRight={headerRight}
    >
      <Stepper step={step} onStepClick={setStep} />
      <div style={{ padding: '4px 0' }}>
        {step === 0 && <StepConfigure data={data} onChange={update} embedDomains={embedDomains} />}
        {step === 1 && <StepSurfaces data={data} onChange={update} />}
        {step === 2 && <StepPreview data={data} onChange={update} embedDomains={embedDomains} />}
      </div>
    </Drawer>
  );
}
