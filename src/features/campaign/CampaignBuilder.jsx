import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { renderEmailHtml } from '../email-builder/patchEmailHtml';
import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { SendTestPopover } from '../email-builder/SendTestPopover';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Select } from '../../components/Select/Select';
import { Toggle } from '../../components/Toggle/Toggle';
import { makeInitialDocument } from '../email-builder/initialDocument';
import styles from './CampaignBuilder.module.css';

// Static option lists — would come from Supabase audience / sender tables in
// production. Kept here so the screen renders without extra fetches.
const AUDIENCE_OPTIONS = [
  { id: 'all-patients',   label: 'All Patients' },
  { id: 'diabetics',      label: 'Diabetics (HbA1c > 9)' },
  { id: 'maternal',       label: 'Maternal Care' },
  { id: 'pediatric',      label: 'Pediatric' },
  { id: 'cardiac',        label: 'Cardiac Care' },
  { id: 'over-65',        label: 'Patients over 65' },
  { id: 'rosewood',       label: 'Rosewood Clinic' },
  { id: 'rome-office',    label: 'Rome Office' },
];

const SENDER_OPTIONS = [
  { value: 'stanford-care',  label: 'Stanford Care Center' },
  { value: 'fold-health',    label: 'Fold Health Team' },
  { value: 'dr-patel',       label: 'Dr. Patel' },
  { value: 'dr-singh',       label: 'Dr. Singh' },
];

const SEND_FROM_OPTIONS = [
  { value: 'care@fold.care',     label: 'care@fold.care' },
  { value: 'hello@fold.care',    label: 'hello@fold.care' },
  { value: 'noreply@fold.care',  label: 'noreply@fold.care' },
];

const CHANNELS = [
  { key: 'email', label: 'Email',             icon: 'solar:letter-linear' },
  { key: 'sms',   label: 'SMS',               icon: 'solar:chat-round-line-linear' },
  { key: 'push',  label: 'Push Notification', icon: 'solar:bell-linear' },
];

function toIsoOrNull(dateStr) {
  if (!dateStr) return null;
  // Native date input gives YYYY-MM-DD. Persist as midnight UTC of that date.
  const d = new Date(`${dateStr}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function fromIsoToInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function CampaignBuilder() {
  const id = useAppStore(s => s.campaignBuilderId);
  const campaign = useAppStore(s => s.campaigns.find(c => c.id === id));
  const updateFields = useAppStore(s => s.updateCampaignFields);
  const closeBuilder = useAppStore(s => s.closeCampaignBuilder);
  const runCampaign = useAppStore(s => s.runCampaignNow);
  const openTemplate = useAppStore(s => s.openEmailTemplateFromCampaign);
  const showToast = useAppStore(s => s.showToast);
  const [showTestEmail, setShowTestEmail] = useState(false);

  // Build a preview document on the fly when the campaign has no saved
  // template yet, so the user sees something instead of an empty pane.
  // Render it to HTML through the same renderer the production email uses
  // (renderEmailHtml) — Reader on its own can't draw custom block types
  // (NavBar / Social / Table) and skips backgroundImage gradients, so the
  // preview was diverging visually from the actual email export.
  const previewHtml = useMemo(() => {
    const doc = campaign?.emailTemplate
      || makeInitialDocument({ name: campaign?.name || 'Untitled Campaign' });
    const html = renderEmailHtml(doc);
    // Prepend a thin transparent scrollbar style so the preview iframe doesn't
    // render with the OS-default dark scrollbar. Preview-only — does not
    // affect the actual email HTML delivered to recipients. !important wins
    // against whatever the email template ships with.
    const scrollbarCss = `<style>
      html, body { scrollbar-width: thin !important; scrollbar-color: rgba(0,0,0,0.28) transparent !important; }
      ::-webkit-scrollbar { width: 8px !important; height: 8px !important; background: transparent !important; }
      ::-webkit-scrollbar-track { background: transparent !important; border: none !important; box-shadow: none !important; }
      ::-webkit-scrollbar-corner { background: transparent !important; }
      ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.28) !important; border-radius: 4px !important; border: 2px solid transparent !important; background-clip: padding-box !important; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.45) !important; background-clip: padding-box !important; }
    </style>`;
    return scrollbarCss + html;
  }, [campaign?.emailTemplate, campaign?.name]);

  if (!campaign) {
    return (
      <div className={styles.builder}>
        <div className={styles.loading}>Loading campaign…</div>
      </div>
    );
  }

  const set = (patch) => updateFields(patch);
  const required = ['name', 'audienceInclude', 'sendVia', 'subjectLine'];
  const isComplete = required.every(k => {
    const v = campaign[k];
    return Array.isArray(v) ? v.length > 0 : !!v;
  });

  return (
    <div className={styles.builder}>
      {/* ── Left pane: form ────────────────────────────────────── */}
      <div className={styles.leftPane}>
        <div className={styles.leftHeader}>
          <h2 className={styles.title}>New Campaign</h2>
        </div>
        <div className={styles.leftScroll}>
          <FieldGroup>
            <FieldRow>
              <Label htmlFor="campaign-name" required>Campaign Name</Label>
              <button
                className={styles.aiBtn}
                onClick={() => showToast('Write with AI — coming soon')}
                type="button"
              >
                <Icon name="solar:magic-stick-3-linear" size={14} color="var(--primary-300)" />
                Write with AI
              </button>
            </FieldRow>
            {(() => {
              // "Untitled Campaign" is the placeholder name we INSERT into the
              // DB when the user first opens the builder. Treat it as empty for
              // both the input value AND the char counter so the two never
              // disagree.
              const displayName = campaign.name === 'Untitled Campaign' ? '' : (campaign.name || '');
              return (
                <>
                  <Input
                    id="campaign-name"
                    placeholder="Enter Campaign Name"
                    value={displayName}
                    maxLength={60}
                    onChange={e => set({ name: e.target.value })}
                  />
                  <CharCount value={displayName} max={60} />
                </>
              );
            })()}
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="campaign-desc">Description</Label>
            <Textarea
              id="campaign-desc"
              placeholder="Briefly describe the campaign objective"
              value={campaign.description || ''}
              onChange={e => set({ description: e.target.value })}
              rows={3}
            />
          </FieldGroup>

          <SectionTitle>Select Audience</SectionTitle>

          <FieldGroup>
            <Label required>Include</Label>
            <ChipMultiSelect
              options={AUDIENCE_OPTIONS}
              value={campaign.audienceInclude || []}
              onChange={v => set({ audienceInclude: v })}
              placeholder="Search or Select Audience"
            />
            {(campaign.audienceExclude || []).length === 0 ? (
              <button className={styles.linkBtn} onClick={() => set({ audienceExclude: ['__placeholder__'] })} type="button">
                <Icon name="solar:add-circle-linear" size={14} color="var(--primary-300)" />
                Add Exclusion
              </button>
            ) : (
              <>
                <Label>Exclude</Label>
                <ChipMultiSelect
                  options={AUDIENCE_OPTIONS}
                  value={(campaign.audienceExclude || []).filter(v => v !== '__placeholder__')}
                  onChange={v => set({ audienceExclude: v.length === 0 ? [] : v })}
                  placeholder="Search or Select Audience to exclude"
                />
              </>
            )}
          </FieldGroup>

          <FieldGroup>
            <FieldRow>
              <Label required>Send Via</Label>
              <Icon name="solar:info-circle-linear" size={12} color="var(--neutral-200)" />
            </FieldRow>
            <RadioGroup
              options={CHANNELS}
              value={(campaign.sendVia || ['email'])[0]}
              onChange={v => set({ sendVia: [v], channel: v })}
            />
          </FieldGroup>

          <FieldGroup>
            <FieldRow>
              <Label>Campaign Start Date</Label>
              <Icon name="solar:info-circle-linear" size={12} color="var(--neutral-200)" />
            </FieldRow>
            <div className={styles.startModeRow}>
              <RadioGroup
                inline
                options={[
                  { key: 'immediately', label: 'Immediately' },
                  { key: 'scheduled',   label: 'Schedule for Later' },
                ]}
                value={campaign.startMode || 'immediately'}
                onChange={v => set({ startMode: v, startAt: v === 'immediately' ? null : campaign.startAt })}
              />
            </div>
            {campaign.startMode === 'scheduled' && (
              <input
                type="date"
                className={styles.dateInput}
                aria-label="Campaign start date"
                value={fromIsoToInput(campaign.startAt)}
                onChange={e => set({ startAt: toIsoOrNull(e.target.value) })}
              />
            )}
          </FieldGroup>

          <FieldGroup>
            <Label required>Campaign End Date</Label>
            <input
              type="date"
              className={styles.dateInput}
              aria-label="Campaign end date"
              value={fromIsoToInput(campaign.endDate)}
              onChange={e => set({ endDate: toIsoOrNull(e.target.value) })}
              placeholder="Select the End Date"
            />
          </FieldGroup>
        </div>
      </div>

      {/* ── Right pane: email config + preview ─────────────────── */}
      <div className={styles.rightPane}>
        <div className={styles.topBar}>
          <Toggle
            items={[
              { key: 'one_time', label: 'One-Time' },
              { key: 'sequence', label: 'Sequence' },
            ]}
            active={campaign.campaignType || 'one_time'}
            size="S"
            onChange={v => set({ campaignType: v })}
          />
          <div className={styles.topRight} style={{ position: 'relative' }}>
            <Button
              variant="secondary"
              size="S"
              leadingIcon="solar:letter-linear"
              onClick={() => setShowTestEmail(v => !v)}
            >
              Send Test Mail
            </Button>
            {showTestEmail && (
              <SendTestPopover
                campaignId={id}
                onClose={() => setShowTestEmail(false)}
              />
            )}
            <Button
              variant="primary"
              size="S"
              disabled={!isComplete}
              onClick={async () => { const ok = await runCampaign(); if (ok) closeBuilder(); }}
            >
              Run Campaign Now
            </Button>
            <CloseButton onClick={closeBuilder} />
          </div>
        </div>

        <div className={styles.senderRow}>
          <FieldCol>
            <Label required>Sender Name</Label>
            <Select
              options={SENDER_OPTIONS}
              value={campaign.senderName}
              onChange={v => set({ senderName: v })}
              placeholder="Select the Sender Name"
            />
          </FieldCol>
          <FieldCol>
            <Label required>Send From</Label>
            <Select
              options={SEND_FROM_OPTIONS}
              value={campaign.sendFrom}
              onChange={v => set({ sendFrom: v })}
              placeholder="Select the Delivery Email Address"
            />
          </FieldCol>
        </div>

        <div className={styles.previewWrap}>
          <div className={styles.previewCard}>
            <div className={styles.previewSubjectRow}>
              <Label required>Subject Line</Label>
              <Input
                placeholder="Enter your Subject Line"
                value={campaign.subjectLine || ''}
                onChange={e => set({ subjectLine: e.target.value })}
              />
            </div>
            <div className={styles.previewDesignRow}>
              <span className={styles.previewDesignLabel}>Email Design</span>
              <div className={styles.previewLinks}>
                <button className={styles.linkBtn} onClick={openTemplate} type="button">
                  <Icon name="solar:pen-2-linear" size={12} color="var(--primary-300)" />
                  Edit Template
                </button>
                <span className={styles.linkDivider} />
                <button className={styles.linkBtn} onClick={openTemplate} type="button">
                  <Icon name="solar:layers-linear" size={12} color="var(--primary-300)" />
                  Change Template
                </button>
              </div>
            </div>
            <div className={styles.previewFrame}>
              <iframe
                title="Email preview"
                sandbox="allow-same-origin"
                srcDoc={previewHtml}
                className={styles.previewIframe}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Layout primitives ───────────────────────────────────────────────────
function FieldGroup({ children }) {
  return <div className={styles.fieldGroup}>{children}</div>;
}
function FieldRow({ children }) {
  return <div className={styles.fieldRow}>{children}</div>;
}
function FieldCol({ children }) {
  return <div className={styles.fieldCol}>{children}</div>;
}
function Label({ children, required, htmlFor }) {
  return (
    <label className={styles.label} htmlFor={htmlFor}>
      {children}
      {required && <span className={styles.required}> *</span>}
    </label>
  );
}
function SectionTitle({ children }) {
  return <h3 className={styles.sectionTitle}>{children}</h3>;
}
function CharCount({ value, max }) {
  const len = (value || '').length;
  return <span className={styles.charCount}>{len}/{max}</span>;
}

// ── Radio group ─────────────────────────────────────────────────────────
function RadioGroup({ options, value, onChange, inline }) {
  return (
    <div className={inline ? styles.radioInline : styles.radioStack}>
      {options.map(opt => {
        const selected = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={selected}
            className={[styles.radioOption, selected ? styles.radioOptionSelected : ''].join(' ')}
            onClick={() => onChange(opt.key)}
          >
            <span className={[styles.radioDot, selected ? styles.radioDotSelected : ''].join(' ')} />
            {opt.icon && <Icon name={opt.icon} size={14} color={selected ? 'var(--primary-300)' : 'var(--neutral-300)'} />}
            <span className={styles.radioLabel}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Chip multi-select ───────────────────────────────────────────────────
function ChipMultiSelect({ options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const selectedIds = value || [];

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedSet = new Set(selectedIds);
  const available = options.filter(o => !selectedSet.has(o.id) && o.label.toLowerCase().includes(query.toLowerCase()));
  const labelFor = id => options.find(o => o.id === id)?.label || id;

  const toggle = (id) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter(x => x !== id));
    else onChange([...selectedIds, id]);
  };

  return (
    <div ref={ref} className={styles.chipSelect}>
      <div className={styles.chipSelectControl} onClick={() => setOpen(true)}>
        {selectedIds.length === 0 && !open ? (
          <span className={styles.chipPlaceholder}>{placeholder}</span>
        ) : (
          <>
            {selectedIds.map(id => (
              <span key={id} className={styles.chip}>
                {labelFor(id)}
                <CloseButton
                  size={12}
                  onClick={e => { e.stopPropagation(); toggle(id); }}
                  className={styles.chipRemove}
                  label={`Remove ${labelFor(id)}`}
                />
              </span>
            ))}
            {open && (
              <input
                autoFocus
                className={styles.chipInput}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={selectedIds.length === 0 ? placeholder : ''}
              />
            )}
          </>
        )}
        <span className={styles.chipChevron}>
          <Icon name="solar:alt-arrow-down-linear" size={14} color="var(--neutral-300)" />
        </span>
      </div>
      {open && available.length > 0 && (
        <div className={styles.chipDropdown}>
          {available.map(o => (
            <button
              key={o.id}
              type="button"
              className={styles.chipOption}
              onClick={() => { toggle(o.id); setQuery(''); }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

