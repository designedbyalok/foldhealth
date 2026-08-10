import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { Input as FoldInput } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { Link } from '../../components/Link/Link';
import { Avatar } from '../../components/Avatar/Avatar';
import { Badge } from '../../components/Badge/Badge';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { TableIcon, MiniCloseIcon, Spinner, ReplaceIcon, FileErrorIllustration } from './components/icons.jsx';
import PaginationBar from './components/PaginationBar.jsx';
import SectionAccordion from './components/SectionAccordion.jsx';
import FileChipCard from './components/FileChipCard.jsx';
import { FOLD_DB, FOLD_DB_MAP } from './data/fold-db.js';
import { fmtAge } from './data/formatters.js';

const Input = (props) => <FoldInput {...props} />;
Input.TextArea = ({ rows = 3, ...props }) => <Textarea rows={rows} {...props} />;

const mkIcon = (name) => ({ size = 16, color = 'currentColor', style }) => (
  <Icon name={name} size={size} color={color} style={style} />
);
export const AddSquareLinear = mkIcon('solar:add-square-linear');
const AltArrowDownLinear = mkIcon('solar:alt-arrow-down-linear');
export const CloseCircleLinear = mkIcon('solar:close-circle-linear');
const DangerCircleLinear = mkIcon('solar:danger-circle-linear');
export const InfoCircleLinear = mkIcon('solar:info-circle-linear');
const MagniferLinear = mkIcon('solar:magnifer-linear');
export const UsersGroupRoundedLinear = mkIcon('solar:users-group-rounded-linear');

export function BulkSelectIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5.33 19.27C5.61 19.27 5.83 19.04 5.83 18.77C5.83 18.49 5.61 18.27 5.33 18.27V18.77V19.27ZM18.17 5.23C18.17 5.51 18.39 5.73 18.67 5.73C18.94 5.73 19.17 5.51 19.17 5.23H18.67H18.17ZM10.64 12.98C10.45 12.78 10.14 12.76 9.93 12.95C9.73 13.13 9.71 13.45 9.9 13.65L10.27 13.32L10.64 12.98ZM12.02 15.26L12.39 14.92V14.92L12.02 15.26ZM13.65 15.3L14.01 15.65V15.65L13.65 15.3ZM18.35 11.32C18.55 11.12 18.549 10.808 18.35 10.61C18.16 10.42 17.84 10.42 17.65 10.61L18 10.97L18.35 11.32ZM12 5.23V5.73H15.33V5.23V4.73H12V5.23ZM22 11.7H21.5V15.53H22H22.5V11.7H22ZM15.33 22V21.5H12V22V22.5H15.33V22ZM5.33 15.53H5.83V11.7H5.33H4.83V15.53H5.33ZM12 22V21.5C10.41 21.5 9.27 21.499 8.41 21.39C7.55 21.27 7.04 21.062 6.66 20.69L6.31 21.05L5.96 21.41C6.56 21.99 7.32 22.25 8.28 22.38C9.23 22.501 10.44 22.5 12 22.5V22ZM5.33 15.53H4.83C4.83 17.04 4.83 18.23 4.96 19.15C5.09 20.089 5.36 20.83 5.96 21.41L6.31 21.05L6.66 20.69C6.28 20.33 6.06 19.84 5.95 19.013C5.83 18.175 5.83 17.073 5.83 15.53H5.33ZM22 15.53H21.5C21.5 17.073 21.5 18.175 21.38 19.013C21.27 19.84 21.05 20.33 20.68 20.69L21.02 21.05L21.37 21.41C21.971 20.83 22.24 20.089 22.37 19.15C22.5 18.23 22.5 17.04 22.5 15.53H22ZM15.33 22V22.5C16.891 22.5 18.108 22.501 19.06 22.38C20.016 22.25 20.77 21.99 21.37 21.41L21.02 21.05L20.68 20.69C20.3 21.062 19.78 21.27 18.93 21.39C18.06 21.499 16.92 21.5 15.33 21.5V22ZM15.33 5.23V5.73C16.92 5.73 18.06 5.73 18.93 5.85C19.78 5.96 20.3 6.17 20.68 6.54L21.02 6.18L21.37 5.82C20.77 5.24 20.016 4.98 19.06 4.86C18.108 4.73 16.891 4.73 15.33 4.73V5.23ZM22 11.7H22.5C22.5 10.19 22.5 9.01 22.37 8.08C22.24 7.14 21.971 6.4 21.37 5.82L21.02 6.18L20.68 6.54C21.05 6.9 21.27 7.4 21.38 8.22C21.5 9.06 21.5 10.16 21.5 11.7H22ZM12 5.23V4.73C10.44 4.73 9.23 4.73 8.28 4.86C7.32 4.98 6.56 5.24 5.96 5.82L6.31 6.18L6.66 6.54C7.04 6.17 7.55 5.96 8.41 5.85C9.27 5.73 10.41 5.73 12 5.73V5.23ZM5.33 11.7H5.83C5.83 10.16 5.83 9.06 5.95 8.22C6.06 7.4 6.28 6.9 6.66 6.54L6.31 6.18L5.96 5.82C5.36 6.4 5.09 7.14 4.96 8.08C4.83 9.01 4.83 10.19 4.83 11.7H5.33ZM10.89 2V2.5H15.33V2V1.5H10.89V2ZM2 15.53H2.5V10.62H2H1.5V15.53H2ZM2 15.53H1.5C1.5 17.61 3.23 19.27 5.33 19.27V18.77V18.27C3.75 18.27 2.5 17.03 2.5 15.53H2ZM15.33 2V2.5C16.91 2.5 18.17 3.74 18.17 5.23H18.67H19.17C19.17 3.16 17.44 1.5 15.33 1.5V2ZM10.89 2V1.5C8.81 1.5 7.2 1.499 5.95 1.66C4.68 1.83 3.71 2.17 2.95 2.9L3.3 3.26L3.65 3.62C4.19 3.1 4.92 2.8 6.08 2.65C7.25 2.501 8.78 2.5 10.89 2.5V2ZM2 10.62H2.5C2.5 8.57 2.5 7.09 2.66 5.96C2.81 4.84 3.11 4.14 3.65 3.62L3.3 3.26L2.95 2.9C2.19 3.64 1.84 4.59 1.67 5.82C1.5 7.04 1.5 8.6 1.5 10.62H2ZM10.27 13.32L9.9 13.65L11.65 15.59L12.02 15.26L12.39 14.92L10.64 12.98L10.27 13.32ZM13.65 15.3L14.01 15.65L18.35 11.32L18 10.97L17.65 10.61L13.3 14.95L13.65 15.3ZM12.02 15.26L11.65 15.59C12.27 16.28 13.35 16.31 14.01 15.65L13.65 15.3L13.3 14.95C13.049 15.2 12.63 15.18 12.39 14.92L12.02 15.26Z" fill="currentColor"/>
    </svg>
  );
}

/* Group name — clamped to 2 lines; shows the full name via the Tooltip component only when truncated.
   The structure stays stable (always Tooltip-wrapped) so the measured span node never swaps out;
   the tooltip only opens when the text is actually truncated. */
const GROUP_NAME_STYLE = {
  fontSize: 14, fontWeight: 500, color: 'var(--neutral-400)', lineHeight: 1.4, minWidth: 0,
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word',
};

export function GroupName({ name }) {
  const ref = useRef(null);
  const [truncated, setTruncated] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const check = () => { if (!cancelled) setTruncated(el.scrollHeight > el.clientHeight + 1); };
    check();
    // The clamped span's box height is fixed, so a font swap grows scrollHeight
    // without resizing the box — re-check after paint, on resize, and after fonts load.
    const raf = requestAnimationFrame(check);
    const timers = [100, 400, 1000].map(d => setTimeout(check, d));
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    if (document.fonts?.ready) document.fonts.ready.then(check);
    return () => { cancelled = true; cancelAnimationFrame(raf); timers.forEach(clearTimeout); ro.disconnect(); };
  }, [name]);

  return (
    // Empty label when not truncated → shared Tooltip renders nothing.
    <Tooltip label={truncated ? name : ''} maxWidth={380}>
      <span
        ref={ref}
        style={GROUP_NAME_STYLE}
      >
        {name}
      </span>
    </Tooltip>
  );
}

/* ── CSV parser (replaces xlsx) — handles quoted fields, escaped quotes, CRLF ── */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') { inQuotes = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else { field += c; }
  }
  if (field !== '' || row.length) { row.push(field); if (row.some(v => v !== '')) rows.push(row); }
  return rows;
}

/* Parse an HTML-table .xls (the format produced by "Download File with Errors")
   so the download → correct → reupload round-trip works without the xlsx lib. */
function parseHtmlTable(text) {
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let tr;
  while ((tr = trRe.exec(text))) {
    const cells = [];
    let td;
    while ((td = tdRe.exec(tr[1]))) {
      cells.push(td[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim());
    }
    if (cells.some(c => c !== '')) rows.push(cells);
  }
  return rows;
}

/* Route a file's text to the right parser (HTML-table .xls vs CSV/TSV). */
function parseTable(text) {
  return /<table[\s>]/i.test(text) ? parseHtmlTable(text) : parseCsv(text);
}


/* ─── Population Groups — data ───────────────────────────────────────────── */
const POP_GROUPS = [
  { id:1,  name:'Patients having CAD with LDL > 100 and not seen in the last 3 months',     type:'Dynamic', count:43,   inactive:7,  updated:'01/16/2024 06:30 PM', created:'02/22/2024' },
  { id:2,  name:'45 years or older without screening colonoscopy',                            type:'Dynamic', count:84,   inactive:12, updated:'01/16/2024 06:30 PM', created:'02/22/2024' },
  { id:3,  name:'Diabetic patients with HBA1C Above 9 and are not on Statin',               type:'Dynamic', count:null, inactive:0,  updated:'01/16/2024 06:30 PM', created:'02/22/2024' },
  { id:4,  name:"Active members who haven't interacted in last 6 months",                    type:'Dynamic', count:31,   inactive:3,  updated:'01/16/2024 06:30 PM', created:'02/22/2024' },
  { id:5,  name:'Diabetic Patients with HBA1C between 8 and 9',                              type:'Static',  count:44,   inactive:8,  updated:'01/16/2024 06:30 PM', created:'02/22/2024' },
  { id:6,  name:'Diabetic Complications Blood Glucose Patients',                              type:'Dynamic', count:79,   inactive:21, updated:'01/16/2024 06:30 PM', created:'02/22/2024' },
  { id:7,  name:'Hypertension Patients with prescribed antihypertensive medications',        type:'Static',  count:14,   inactive:2,  updated:'01/16/2024 06:30 PM', created:'02/22/2024' },
  { id:8,  name:'Patients with HBA1C Above 7',                                               type:'Dynamic', count:32,   inactive:5,  updated:'01/16/2024 06:30 PM', created:'02/22/2024' },
  { id:9,  name:'Hypertension Patients with BMI > 25 on last appointment',                   type:'Dynamic', count:48,   inactive:9,  updated:'01/16/2024 06:30 PM', created:'02/22/2024' },
  { id:10, name:'CHF patients with ejection fraction below 40% not on ACE inhibitor',        type:'Dynamic', count:27,   inactive:4,  updated:'03/05/2024 10:15 AM', created:'03/05/2024' },
  { id:11, name:'Patients 65+ with no annual wellness visit in past 12 months',               type:'Dynamic', count:112,  inactive:18, updated:'03/08/2024 02:45 PM', created:'03/08/2024' },
  { id:12, name:'COPD patients with 2+ ED visits in the last 90 days',                       type:'Dynamic', count:19,   inactive:1,  updated:'03/12/2024 09:00 AM', created:'03/12/2024' },
  { id:13, name:'High-risk postpartum patients within 60 days of delivery',                   type:'Static',  count:8,    inactive:0,  updated:'03/15/2024 11:30 AM', created:'03/15/2024' },
  { id:14, name:'SNP members not seen by PCP in last 6 months',                               type:'Dynamic', count:56,   inactive:11, updated:'03/20/2024 03:00 PM', created:'03/20/2024' },
  { id:15, name:'Patients on 5+ chronic medications without a medication reconciliation',     type:'Dynamic', count:73,   inactive:14, updated:'03/22/2024 08:45 AM', created:'03/22/2024' },
  { id:16, name:'Atrial fibrillation patients not on anticoagulation therapy',                type:'Dynamic', count:35,   inactive:6,  updated:'03/25/2024 04:20 PM', created:'03/25/2024' },
  { id:17, name:'Pediatric patients with asthma and 1+ hospitalization this year',            type:'Static',  count:11,   inactive:0,  updated:'04/01/2024 01:10 PM', created:'04/01/2024' },
  { id:18, name:'Patients with depression screening overdue by 6 months',                     type:'Dynamic', count:91,   inactive:22, updated:'04/03/2024 10:00 AM', created:'04/03/2024' },
  { id:19, name:'CKD Stage 3–4 patients not referred to nephrology',                          type:'Dynamic', count:24,   inactive:3,  updated:'04/07/2024 07:30 AM', created:'04/07/2024' },
  { id:20, name:'Members with uncontrolled type 2 diabetes and high BMI',                     type:'Dynamic', count:62,   inactive:9,  updated:'04/10/2024 12:00 PM', created:'04/10/2024' },
  { id:21, name:'Post-discharge patients without follow-up within 7 days',                    type:'Dynamic', count:18,   inactive:2,  updated:'04/14/2024 09:45 AM', created:'04/14/2024' },
  { id:22, name:'Patients with osteoporosis and no DEXA scan in 2 years',                     type:'Static',  count:37,   inactive:5,  updated:'04/16/2024 03:30 PM', created:'04/16/2024' },
  { id:23, name:'High-cost members with 3+ specialist visits and no care coordination',       type:'Dynamic', count:15,   inactive:1,  updated:'04/18/2024 11:00 AM', created:'04/18/2024' },
  { id:24, name:'Patients with tobacco use and no cessation counseling',                       type:'Dynamic', count:88,   inactive:16, updated:'04/22/2024 02:15 PM', created:'04/22/2024' },
  { id:25, name:'Pediatric immunization gap list — missing MMR booster',                       type:'Static',  count:29,   inactive:0,  updated:'04/25/2024 08:00 AM', created:'04/25/2024' },
  { id:26, name:'Patients with BMI ≥ 35 and no referral to weight management program',        type:'Dynamic', count:54,   inactive:7,  updated:'04/28/2024 05:00 PM', created:'04/28/2024' },
  { id:27, name:'Patients awaiting colonoscopy with bowel prep instructions not sent',         type:'Static',  count:6,    inactive:0,  updated:'05/01/2024 10:30 AM', created:'05/01/2024' },
  { id:28, name:'Members with lupus and no rheumatology visit in last 12 months',              type:'Dynamic', count:21,   inactive:4,  updated:'05/05/2024 01:45 PM', created:'05/05/2024' },
  { id:29, name:'Patients with fall risk score ≥ 3 and no PT referral on record',              type:'Dynamic', count:40,   inactive:8,  updated:'05/08/2024 09:20 AM', created:'05/08/2024' },
];

const FILTER_OPTIONS = [
  { value:'static-search', label:'Static (Search & Add Members)' },
  { value:'static-csv',    label:'Static (Upload From CSV File)' },
  { value:'dynamic',       label:'Dynamic (Add By Patient characteristics)' },
];

const MEMBERSHIP_OPTS = ['All Status','Active','Inactive','Churned','Pending'];

const CRIT_ATTRS = [
  { label:'Age',            ops:['=','≠','>','<','≥','≤'],               type:'number' },
  { label:'Gender',         ops:['is','is not'],                          type:'select', opts:['Male','Female','Other'] },
  { label:'Condition',      ops:['includes','excludes'],                  type:'text' },
  { label:'Risk Level',     ops:['is','is not'],                          type:'select', opts:['High Risk','Medium Risk','Low Risk'] },
  { label:'Program Status', ops:['is','is not'],                          type:'select', opts:['Active','Completed','Enrolled','Discharged'] },
  { label:'Language',       ops:['is','is not'],                          type:'select', opts:['English','Spanish','French','Other'] },
  { label:'Lace Score',     ops:['>','<','≥','≤','='],                    type:'number' },
  { label:'HbA1c',          ops:['>','<','≥','≤'],                         type:'number' },
  { label:'Discharge Date', ops:['within last','before','after'],         type:'text' },
  { label:'Admission Type', ops:['is','is not'],                          type:'select', opts:['Inpatient','Outpatient','Emergency'] },
];

/* FOLD_DB and FOLD_DB_MAP are imported from './constants/fold-db.js' */
const PROC_STEPS = [
  'Reading the uploaded file',
  'Extracting values for processing',
  'Matching Patient IDs with Fold Patients',
];

/* ─── DrawerSelect: styled identically to the drawer Input fields ─────────── */
export function DrawerSelect({ value, onChange, options, placeholder, disabled = false, hint }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const handler = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  const selectedLabel = options.find(o => o.value === value)?.label;
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div
        onClick={() => !disabled && setOpen(v => !v)}
        style={{
          height:32, padding:'0 8px', boxSizing:'border-box',
          border:`0.5px solid ${open ? 'var(--primary-300)' : 'var(--neutral-200)'}`,
          borderRadius:6,
          background: disabled ? 'var(--neutral-50)' : 'var(--neutral-0)',
          display:'flex', alignItems:'center', gap:4,
          fontSize:14, fontFamily:'Inter, sans-serif',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: open ? '0 0 0 3px var(--primary-100)' : 'none',
          transition:'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:400,
          color: disabled ? 'var(--neutral-150)' : selectedLabel ? 'var(--neutral-400)' : 'var(--neutral-200)' }}>
          {selectedLabel || placeholder}
        </span>
        <AltArrowDownLinear size={12} color={disabled ? 'var(--neutral-150)' : 'var(--neutral-200)'} />
      </div>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'var(--neutral-0)',
          border:'0.5px solid var(--neutral-100)', borderRadius:8,
          boxShadow:'0 4px 16px rgba(0,0,0,0.10)', zIndex:2200, padding:'8px' }}>
          {options.map(opt => (
            <div key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{ padding:'7px 10px', fontSize:14, fontFamily:'Inter, sans-serif',
                color:'var(--neutral-400)', cursor:'pointer', borderRadius:4, marginBottom:2,
                background: value === opt.value ? 'var(--primary-50)' : 'var(--neutral-0)',
                border: value === opt.value ? '0.5px solid var(--primary-200)' : '0.5px solid transparent',
                transition:'background 0.1s' }}
              onMouseEnter={e => { if (value !== opt.value) e.currentTarget.style.background = 'var(--neutral-50)'; }}
              onMouseLeave={e => { if (value !== opt.value) e.currentTarget.style.background = value === opt.value ? 'var(--primary-50)' : 'var(--neutral-0)'; }}>
              {opt.label}
            </div>
          ))}
        </div>
      )}
      {hint && <div style={{ fontSize:12, color:'var(--neutral-200)', marginTop:4 }}>{hint}</div>}
    </div>
  );
}

/* ─── Figma-aligned summary components (grey-button / default Create Group flow) ── */

/* CellOuter at module level — MUST be outside FigmaIncorrectRow so React doesn't remount on every render, which would lose cursor focus */
export function CellOuter({ err, children }) {
  return (
    <div style={{
      border: `0.5px solid ${err ? 'var(--status-error)' : 'var(--neutral-200)'}`,
      borderRadius: 4,
      background: err ? 'var(--status-error-light)' : 'var(--neutral-0)',
      display: 'flex', alignItems: 'center', overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

/* fmtAge — imported from ./utils/formatters.js */

export function FigmaMatchedSection({ patients, expanded, onToggle, allDone }) {
  const title        = allDone ? 'Review Pop Group' : 'Matched Members';
  const gradientFrom = allDone ? 'var(--status-success-light)' : 'var(--status-success-light)';
  return (
    /* SectionAccordion handles header, badge, chevron, and collapse logic.
       Pass onToggle=undefined when allDone so the header is non-collapsible. */
    <SectionAccordion
      title={title}
      count={patients.length}
      badgeColor="var(--status-success)"
      gradientFrom={gradientFrom}
      expanded={allDone || expanded}
      onToggle={allDone ? undefined : onToggle}
    >
      <div className="thin-scroll" style={{ overflowY:'visible' }}>
        {patients.map((p, i) => {
          const nameParts = (p.name || '').split(' ');
          const initials  = ((nameParts[0]?.[0] || '') + (nameParts[1]?.[0] || '')).toUpperCase();
          return (
            <div key={p.id || i} style={{ padding:'8px 12px', borderBottom:'0.5px solid var(--neutral-100)', display:'flex', alignItems:'center', gap:10, fontFamily:'Inter,sans-serif' }}>
              <div style={{ width:28, height:28, borderRadius:4, background:'var(--primary-100)', border:'0.5px solid var(--primary-200)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:400, color:'var(--primary-300)', flexShrink:0 }}>
                {initials}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:500, color:'var(--neutral-400)' }}>{p.name}</div>
                <div style={{ fontSize:14, fontWeight:400, color:'var(--neutral-200)' }}>{p.id} · {fmtAge(p.dob)}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
                <circle cx="8" cy="8" r="8" fill="var(--status-success)"/>
                <path d="M4.5 8.5l2.5 2.5 4.5-5" stroke="var(--neutral-0)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          );
        })}
      </div>
    </SectionAccordion>
  );
}

const FIGMA_INCORRECT_INPUT_ST = {
  flex: 1, height: 32, border: 'none', background: 'transparent',
  padding: '0 8px', fontSize: 14, outline: 'none',
  fontFamily: 'Inter,sans-serif', color: 'var(--neutral-400)', boxSizing: 'border-box',
  minWidth: 0,
};
const FIGMA_INCORRECT_HDR_COLS = ['Patient ID', 'First Name', 'Last Name', 'Date of Birth', 'Actions'];
const DUPLICATE_COL_HDR = { fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)', fontFamily: 'Inter,sans-serif' };
export const TABLE_TH_STYLE = {
  padding: '8px 16px', fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)',
  borderBottom: '0.5px solid var(--neutral-150)', background: 'var(--neutral-0)',
  position: 'sticky', top: 0, zIndex: 2, textAlign: 'left',
  whiteSpace: 'nowrap', userSelect: 'none',
};
export const TABLE_TD_STYLE = { padding: '12px 16px', fontSize: 14, fontWeight: 400, color: 'var(--neutral-300)', verticalAlign: 'middle' };

export function FigmaIncorrectRow({ row, onAdd, onRemove, isLast, onToast, matchedIds }) {
  const [foldId,    setFoldId]    = React.useState(row.rawId    || '');
  const [firstName, setFirstName] = React.useState(row.rawFn   || '');
  const [lastName,  setLastName]  = React.useState(row.rawLn   || '');
  const [dob,       setDob]       = React.useState(row.rawDob  || '');
  const [loading,   setLoading]   = React.useState(false);
  const [resolved,  setResolved]  = React.useState(null);
  const timerRef = React.useRef(null);

  const handleFoldIdChange = val => {
    setFoldId(val);
    setResolved(null);
    clearTimeout(timerRef.current);
    if (!val.trim()) { setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(() => {
      const found = FOLD_DB_MAP[val.trim().toUpperCase()] || null;
      setResolved(found);
      setLoading(false);
    }, 480);
  };

  React.useEffect(() => {
    if (foldId) handleFoldIdChange(foldId);
    return () => clearTimeout(timerRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasError = !loading && !resolved && foldId.length > 0;

  /*
  const nameDobSuggestions = React.useMemo(() => {
    const fn = firstName.trim().toLowerCase();
    const ln = lastName.trim().toLowerCase();
    const d  = dob.trim();
    if (!fn || !ln || !d) return [];
    return FOLD_DB.filter(p => {
      const parts = p.name.toLowerCase().split(' ');
      return parts[0] === fn && parts.slice(1).join(' ') === ln && p.dob === d;
    }).slice(0, 1);
  }, [firstName, lastName, dob]);

  const incorrectOtherField = React.useMemo(() => {
    if (!hasError || nameDobSuggestions.length > 0) return null;
    const fn = firstName.trim().toLowerCase();
    const ln = lastName.trim().toLowerCase();
    const d  = dob.trim();
    if (!fn && !ln && !d) return null;
    const fnHit = fn && FOLD_DB.some(p => p.name.toLowerCase().split(' ')[0] === fn);
    const lnHit = ln && FOLD_DB.some(p => p.name.toLowerCase().split(' ').slice(1).join(' ') === ln);
    if (fnHit && lnHit) return 'Date of Birth';
    if (fnHit && !lnHit) return 'Last Name';
    if (!fnHit && lnHit) return 'First Name';
    return 'First Name';
  }, [firstName, lastName, dob, hasError, nameDobSuggestions.length]);
  */

  /* Only show match when Patient ID resolves — no name/DOB fallback */
  const matchLabel = resolved ? 'Patient ID match Found :' : null;
  const matchPat   = resolved || null;

  /* Check if this resolved patient is already in matched list */
  const alreadyMatched = matchPat && matchedIds && matchedIds.has(matchPat.id);
  const displayLabel = alreadyMatched ? 'Patient ID already matched' : matchLabel;

  /* When Patient ID resolves, flag any CSV fields that don't match the DB record */
  const mismatch = React.useMemo(() => {
    if (!resolved) return { firstName: false, lastName: false, dob: false };
    const dbParts = (resolved.name || '').toLowerCase().split(' ');
    const dbFn = dbParts[0] || '';
    const dbLn = dbParts.slice(1).join(' ');
    return {
      firstName: firstName.trim().toLowerCase() !== dbFn,
      lastName:  lastName.trim().toLowerCase()  !== dbLn,
      dob:       dob.trim() !== resolved.dob,
    };
  }, [resolved, firstName, lastName, dob]);

  /* CellOuter is defined at module level above to prevent remounting on re-render (which would lose cursor focus) */

  const [isRemoving, setIsRemoving] = React.useState(false);

  const handleRemoveWithAnim = () => {
    setIsRemoving(true);
    setTimeout(() => onRemove(row.entryId), 270);
  };

  return (
    <div className={isRemoving ? 'row-removing' : ''} style={{ borderBottom: isLast ? 'none' : '0.5px solid var(--neutral-200)', paddingTop: 8, fontFamily: 'Inter,sans-serif' }}>
      {/* Column headers — inside each card per Figma */}
      <div style={{ display: 'flex', paddingRight: 12 }}>
        {FIGMA_INCORRECT_HDR_COLS.map((h, hi) => (
          <div key={h} style={{
            ...(hi < 4 ? { flex: 1, minWidth: 0 } : { width: 130, flexShrink: 0 }),
            padding: '4px 12px',
            display: 'flex', alignItems: 'center',
          }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h}</span>
          </div>
        ))}
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', paddingRight: 12 }}>
        <div style={{ flex: 1, minWidth: 0, padding: '2px 12px 8px' }}>
          <CellOuter err={hasError}>
            <input aria-label="Fold ID" value={foldId} onChange={e => handleFoldIdChange(e.target.value)} style={FIGMA_INCORRECT_INPUT_ST} />
          </CellOuter>
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: '2px 12px 8px' }}>
          <CellOuter err={mismatch.firstName}>
            <input aria-label="First name" disabled value={firstName} style={{ ...FIGMA_INCORRECT_INPUT_ST, background:'var(--neutral-50)', color:'var(--neutral-150)', cursor:'not-allowed' }} />
          </CellOuter>
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: '2px 12px 8px' }}>
          <CellOuter err={mismatch.lastName}>
            <input aria-label="Last name" disabled value={lastName} style={{ ...FIGMA_INCORRECT_INPUT_ST, background:'var(--neutral-50)', color:'var(--neutral-150)', cursor:'not-allowed' }} />
          </CellOuter>
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: '2px 12px 8px' }}>
          <CellOuter err={mismatch.dob}>
            <input aria-label="Date of birth" disabled value={dob} style={{ ...FIGMA_INCORRECT_INPUT_ST, background:'var(--neutral-50)', color:'var(--neutral-150)', cursor:'not-allowed' }} />
          </CellOuter>
        </div>
        <div style={{ width: 130, flexShrink: 0, padding: '2px 12px 8px 12px', display: 'flex', alignItems: 'center' }}>
          <button
            onClick={handleRemoveWithAnim}
            style={{ height: 30, padding: '0 10px', border: '0.5px solid var(--neutral-200)', borderRadius: 4, background: 'var(--neutral-0)', color: 'var(--neutral-300)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--neutral-50)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--neutral-0)'}
          >
            Remove Entry
          </button>
        </div>
      </div>

      {/* Match suggestion */}
      {displayLabel && matchPat && (
        <div style={{ padding: '4px 15px 12px' }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: alreadyMatched ? 'var(--neutral-200)' : 'var(--neutral-400)', marginBottom: 6 }}>{displayLabel}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, background: 'var(--primary-25)', border: '0.5px solid var(--primary-200)', borderRadius: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--primary-100)', border: '0.5px solid var(--primary-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 400, color: 'var(--primary-300)', flexShrink: 0 }}>
              {matchPat.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--neutral-400)' }}>{matchPat.name}</div>
              <div style={{ display: 'flex', gap: 2, alignItems: 'center', fontSize: 14, color: 'var(--neutral-200)' }}>
                <span>{matchPat.id}</span>
                <span>•</span>
                <span>{fmtAge(matchPat.dob)}</span>
              </div>
            </div>
            {!alreadyMatched && (
              <button
                onClick={() => {
                  onAdd(row.entryId, matchPat);
                  /* Show top-centre toast via DOM — bypasses React prop chain */
                  const _t = document.createElement('div');
                  _t.textContent = 'Member added to Matched Members successfully';
                  Object.assign(_t.style, { position:'fixed', top:'12px', left:'50%', transform:'translateX(-50%)', background:'var(--status-success)', color:'var(--neutral-0)', padding:'8px 20px', borderRadius:'8px', fontSize:'14px', fontWeight:'500', zIndex:'99999', pointerEvents:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.18)', fontFamily:'Inter,sans-serif', display:'flex', alignItems:'center', gap:'8px', whiteSpace:'nowrap' });
                  document.body.appendChild(_t);
                  setTimeout(() => { _t.style.opacity = '0'; _t.style.transition = 'opacity 0.3s'; setTimeout(() => _t.remove(), 350); }, 2500);
                }}
                style={{ height: 32, padding: '0 14px', border: '0.5px solid var(--primary-200)', borderRadius: 6, background: 'var(--primary-100)', color: 'var(--primary-300)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', flexShrink: 0, transition: 'background 0.15s, border-color 0.15s, color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-300)'; e.currentTarget.style.borderColor = 'var(--primary-300)'; e.currentTarget.style.color = 'var(--neutral-0)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--primary-100)'; e.currentTarget.style.borderColor = 'var(--primary-200)'; e.currentTarget.style.color = 'var(--primary-300)'; }}
              >
                Add to Matched Members
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && !matchPat && (
        <div style={{ padding: '4px 15px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Spinner size={13} color="var(--primary-300)" />
          <span style={{ fontSize: 12, color: 'var(--neutral-200)' }}>Looking up…</span>
        </div>
      )}

      {/* No match found — Patient ID entered but not in DB */}
      {hasError && !loading && foldId.length > 4 && (
        <div style={{ padding: '0 15px 10px', fontSize: 13, fontWeight: 500, color: 'var(--status-error)' }}>
          No match found.
        </div>
      )}

      {/* Error banner — shown when Fold ID is wrong AND no name+DOB match found */}
      {/* {!loading && incorrectOtherField && (
        <div style={{ padding: '0 15px 12px' }}>
          <div style={{ background:'var(--status-error-light)', border:'0.5px solid rgba(215,40,37,0.1)', borderRadius:4, padding:'4px 6px', display:'flex', alignItems:'center', gap:4 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
              <circle cx="8" cy="8" r="7" stroke="var(--status-error)" strokeWidth="1.2"/>
              <path d="M8 5v3.5" stroke="var(--status-error)" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="8" cy="11" r="0.7" fill="var(--status-error)"/>
            </svg>
            <span style={{ fontSize:12, fontWeight:400, color:'var(--neutral-400)', lineHeight:1.2 }}>
              Enter Correct Fold ID and {incorrectOtherField} to see matches.
            </span>
          </div>
        </div>
      )} */}
    </div>
  );
}

export function FigmaIncorrectSection({ entries, expanded, onToggle, onAdd, onRemove, onToast, matchedIds }) {
  return (
    <SectionAccordion
      title="Members With Incorrect Details"
      count={entries.length}
      badgeColor="var(--status-error)"
      gradientFrom="var(--status-error-light)"
      expanded={expanded}
      onToggle={onToggle}
    >
      {/* Each FigmaIncorrectRow includes its own column headers per Figma spec */}
      <div>
        {entries.map((entry, i) => (
          <FigmaIncorrectRow
            key={entry.entryId || i}
            row={entry}
            onAdd={onAdd}
            onRemove={onRemove}
            isLast={i === entries.length - 1}
            onToast={onToast}
            matchedIds={matchedIds}
          />
        ))}
      </div>
    </SectionAccordion>
  );
}

export function FigmaDuplicateSection({ entries, matched, expanded, onToggle, onRemove }) {
  /* Group entries by rawId — each key is a duplicate group */
  const groups = React.useMemo(() => {
    const g = {};
    entries.forEach(e => { (g[e.rawId] = g[e.rawId] || []).push(e); });
    return g;
  }, [entries]);

  /* selectedToRemove[rawId] = entryId of the row currently selected for removal.
     Defaults to the LAST entry (the duplicate), keyed as 'dup:<entryId>' or 'orig:<rawId>' */
  const [selectedToRemove, setSelectedToRemove] = React.useState(() => {
    const init = {};
    Object.entries(groups).forEach(([rawId, dupes]) => {
      init[rawId] = 'dup:' + dupes[dupes.length - 1].entryId; // select last dup by default
    });
    return init;
  });
  const [removing, setRemoving] = React.useState(new Set());

  const handleRemove = (rawId, key, entryId) => {
    // Animate out then call actual removal
    setRemoving(prev => new Set([...prev, key]));
    setTimeout(() => {
      onRemove(entryId);
      setRemoving(prev => { const n = new Set(prev); n.delete(key); return n; });
    }, 270);
  };

  return (
    <SectionAccordion
      title="Duplicate Entries"
      count={entries.length}
      badgeColor="var(--status-warning)"
      gradientFrom="var(--status-warning-light)"
      expanded={expanded}
      onToggle={onToggle}
    >
      <div>
          {/* Column headers — shared once at the top */}
          <div style={{ display:'flex', padding:'4px 0', borderBottom:'0.5px solid var(--neutral-150)', fontFamily:'Inter,sans-serif' }}>
            <div style={{ flex:1, minWidth:0, padding:'0 12px 0 24px', ...DUPLICATE_COL_HDR }}>Patient ID</div>
            <div style={{ flex:1, minWidth:0, padding:'0 12px', ...DUPLICATE_COL_HDR }}>First Name</div>
            <div style={{ flex:1, minWidth:0, padding:'0 12px', ...DUPLICATE_COL_HDR }}>Last Name</div>
            <div style={{ flex:1, minWidth:0, padding:'0 12px', ...DUPLICATE_COL_HDR }}>Date of Birth</div>
            <div style={{ width:130, flexShrink:0, padding:'0 12px', ...DUPLICATE_COL_HDR }}>Actions</div>
          </div>

          {Object.entries(groups).map(([rawId, dupes], gi) => {
            /* Find the original matched patient for this rawId */
            const origPat = matched?.find(m => (m.id || m.mrn || '').toUpperCase() === rawId.toUpperCase());
            const origKey = 'orig:' + rawId;
            const selKey  = selectedToRemove[rawId];

            /* Build rows: original (from matched) + all duplicates */
            const rows = [];
            if (origPat) {
              rows.push({ key: origKey, entryId: null, isOrig: true, rawId, rawFn: origPat.name?.split(' ')[0] || '', rawLn: origPat.name?.split(' ').slice(1).join(' ') || '', rawDob: origPat.dob || '' });
            }
            dupes.forEach(d => rows.push({ key:'dup:'+d.entryId, entryId: d.entryId, isOrig:false, rawId: d.rawId, rawFn: d.rawFn || '', rawLn: d.rawLn || '', rawDob: d.rawDob || '' }));

            return (
              <div key={rawId} style={{ borderBottom: gi < Object.keys(groups).length - 1 ? '0.5px solid var(--neutral-150)' : 'none' }}>
                {rows.map((row, ri) => {
                  const isSelected = selKey === row.key;
                  const isRemoving = removing.has(row.key);
                  return (
                    <div
                      key={row.key}
                      className={isRemoving ? 'row-removing' : ''}
                      onClick={() => setSelectedToRemove(p => ({ ...p, [rawId]: row.key }))}
                      style={{
                        display:'flex', alignItems:'center',
                        height: 44, /* Fixed height — no layout shift on selection */
                        borderLeft: isSelected ? '3px solid var(--status-warning)' : '3px solid transparent',
                        background: isSelected ? 'var(--status-warning-light)' : 'var(--neutral-0)',
                        cursor:'pointer', fontFamily:'Inter,sans-serif',
                        /* No inner-pair border — only show separator after last row of a group (handled by parent) */
                        transition:'background 0.15s, border-color 0.15s',
                        overflow:'hidden',
                      }}
                    >
                      <div style={{ flex:1, minWidth:0, padding:'0 12px 0 21px', fontSize:14, color:'var(--neutral-400)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.rawId}</div>
                      <div style={{ flex:1, minWidth:0, padding:'0 12px', fontSize:14, color:'var(--neutral-400)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.rawFn}</div>
                      <div style={{ flex:1, minWidth:0, padding:'0 12px', fontSize:14, color:'var(--neutral-400)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.rawLn}</div>
                      <div style={{ flex:1, minWidth:0, padding:'0 12px', fontSize:14, color:'var(--neutral-400)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.rawDob}</div>
                      <div style={{ width:130, flexShrink:0, padding:'0 12px', display:'flex', alignItems:'center' }}>
                        {/* Remove Entry always in DOM but invisible when not selected — preserves height */}
                        <button
                          onClick={e => { e.stopPropagation(); if (isSelected) handleRemove(rawId, row.key, row.entryId); }}
                          style={{ height:30, padding:'0 10px', border:'0.5px solid var(--neutral-200)', borderRadius:4, background:'var(--neutral-0)', color:'var(--neutral-300)', fontSize:12, fontWeight:500, cursor: isSelected ? 'pointer' : 'default', fontFamily:'Inter,sans-serif', whiteSpace:'nowrap', transition:'background 0.15s', opacity: isSelected ? 1 : 0, pointerEvents: isSelected ? 'auto' : 'none' }}
                          onMouseEnter={e => { if (isSelected) e.currentTarget.style.background='var(--neutral-50)'; }}
                          onMouseLeave={e => e.currentTarget.style.background='var(--neutral-0)'}
                        >
                          Remove Entry
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
    </SectionAccordion>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

export function PreviewPanel({ patients, onBack }) {
  const GRID = '28px 1fr 140px 140px 140px';
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, border:'0.5px solid var(--primary-200)', borderRadius:8, overflow:'hidden', margin:'16px' }}>
      {/* Header */}
      <div style={{ padding:'10px 14px', background:'var(--primary-50)', borderBottom:'0.5px solid var(--primary-100)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--neutral-400)', display:'flex', alignItems:'center', gap:7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary-300)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Population Group Preview
          </div>
          <div style={{ fontSize:13, color:'var(--neutral-300)', marginTop:2 }}>
            <span style={{ color:'var(--primary-300)', fontWeight:500 }}>{patients.length}</span> patients will be added to this group
          </div>
        </div>
        <button onClick={onBack} style={{ fontSize:13, color:'var(--neutral-300)', background:'none', border:'0.5px solid var(--neutral-150)', borderRadius:5, cursor:'pointer', padding:'4px 9px', fontFamily:'Inter, sans-serif', display:'flex', alignItems:'center', gap:4 }}>
          ← Back
        </button>
      </div>
      {/* Column headers */}
      <div style={{ display:'grid', gridTemplateColumns:GRID, padding:'5px 14px', background:'var(--neutral-50)', borderBottom:'0.5px solid var(--neutral-150)', gap:8, flexShrink:0 }}>
        {['#','Patient','DOB','MRN','Source'].map((h,hi) => (
          <div key={hi} style={{ fontSize:12, fontWeight:500, color:'var(--neutral-300)' }}>{h}</div>
        ))}
      </div>
      {/* Patient rows */}
      <div className="thin-scroll" style={{ flex:1, overflowY:'auto' }}>
        {patients.map((p, i) => (
          <div key={p.id || i}
            style={{ display:'grid', gridTemplateColumns:GRID, padding:'7px 14px', borderBottom: i < patients.length-1 ? '0.5px solid var(--neutral-100)' : 'none', background:'var(--neutral-0)', alignItems:'center', gap:8, transition:'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background='var(--primary-25)'}
            onMouseLeave={e => e.currentTarget.style.background='var(--neutral-0)'}>
            <div style={{ fontSize:13, color:'var(--neutral-200)', fontWeight:400 }}>{i+1}</div>
            <div style={{ display:'flex', alignItems:'center', gap:7, minWidth:0 }}>
              <div style={{ width:28, height:28, borderRadius:4, background:'var(--primary-100)', border:'0.5px solid var(--primary-200)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:400, color:'var(--primary-300)', flexShrink:0 }}>
                {p.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
              </div>
              <span style={{ fontSize:13, color:'var(--neutral-400)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
            </div>
            <div style={{ fontSize:13, color:'var(--neutral-300)' }}>{p.dob || '—'}</div>
            <div style={{ fontSize:13, color:'var(--neutral-300)' }}>{p.mrn || '—'}</div>
            <div>
              <span style={{ fontSize:12, fontWeight:500, padding:'2px 6px', borderRadius:4,
                color: p.source==='Matched' ? 'var(--status-success)' : 'var(--primary-300)',
                background: p.source==='Matched' ? 'var(--status-success-light)' : 'var(--primary-100)',
                border:`0.5px solid ${p.source==='Matched'?'var(--status-success)':'var(--primary-200)'}`,
              }}>{p.source}</span>
            </div>
          </div>
        ))}
      </div>
      {/* Footer */}
      <div style={{ padding:'8px 14px', borderTop:'0.5px solid var(--primary-100)', background:'var(--primary-25)', display:'flex', alignItems:'center', flexShrink:0 }}>
        <span style={{ fontSize:13, color:'var(--neutral-300)' }}>
          <span style={{ color:'var(--primary-300)', fontWeight:500 }}>{patients.length}</span> patients ready — click <strong>Create</strong> in the header to save.
        </span>
      </div>
    </div>
  );
}

/* ─── NewModePanel — "Download Errors" Create Group flow ─────────────────── */
/* Reusable uploaded-file preview row — table-icon avatar + name/size + replace action.
   Shared by the processing view and the all-members-matched summary (Figma 2023:9490). */
export function FilePreviewCard({ fileName, sizeMB, onReplace }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:16, padding:12, border:'0.5px solid var(--neutral-150)', borderRadius:8, background:'var(--neutral-0)', width:'100%', boxSizing:'border-box', flexShrink:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, flex:'1 0 0', minWidth:0 }}>
        <div style={{ width:32, height:32, borderRadius:8, background:'var(--neutral-50)', border:'0.5px solid var(--neutral-200)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <TableIcon color="var(--neutral-300)" size={18} />
        </div>
        <div style={{ flex:'1 0 0', minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:500, color:'var(--neutral-400)', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fileName}</div>
          <div style={{ fontSize:14, fontWeight:400, color:'var(--neutral-200)', lineHeight:1.2, marginTop:2 }}>{sizeMB} MB</div>
        </div>
      </div>
      {onReplace && (
        <button onClick={onReplace} title="Replace file"
          style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:'none', background:'none', cursor:'pointer', borderRadius:4, transition:'background 0.1s' }}
          onMouseEnter={e => e.currentTarget.style.background='var(--neutral-75)'}
          onMouseLeave={e => e.currentTarget.style.background='none'}>
          <ReplaceIcon size={16} color="var(--neutral-300)" />
        </button>
      )}
    </div>
  );
}

/* One matched/extracted patient row. Shows ID • Age(DOB); the green tick flips
   to a red remove (×) on hover when onRemove is provided. */
/* Stable signature of a group's editable fields — used to detect unsaved edits. */
function groupSignature({ name, description, memberStatus, memberIds }) {
  return JSON.stringify({
    name: (name || '').trim(),
    description: (description || '').trim(),
    memberStatus: memberStatus || 'All Status',
    members: (memberIds || []).map(String).sort(),
  });
}

export function MatchedRow({ p, isLast, onRemove }) {
  const [hover, setHover] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const initials = (p.name || '').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
  const doRemove = () => { setConfirmOpen(false); setRemoving(true); setTimeout(() => onRemove?.(p), 350); };
  return (
    <div
      className={removing ? 'row-removing' : ''}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderBottom: isLast ? 'none' : '0.5px solid var(--neutral-100)', background: (hover || confirmOpen) ? 'var(--primary-25)' : 'transparent', transition:'background 0.1s' }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:8, flex:'1 0 0', minWidth:0 }}>
        <div style={{ width:40, height:40, borderRadius:8, background:'var(--primary-50)', border:'0.5px solid var(--primary-200)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16, fontWeight:400, color:'var(--primary-300)' }}>
          {initials}
        </div>
        <div style={{ flex:'1 0 0', minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:500, color:'var(--neutral-400)', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
          {/* ID • Age(DOB) — full identity, shown consistently in review + edit */}
          <div style={{ display:'flex', alignItems:'center', gap:2, fontSize:14, fontWeight:400, color:'var(--neutral-200)', lineHeight:1.2, marginTop:4, whiteSpace:'nowrap', overflow:'hidden' }}>
            <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{p.id}</span>
            <span>•</span>
            <span>{fmtAge(p.dob)}</span>
          </div>
        </div>
      </div>
      {/* edit phase 2 — patient delete disabled in the Create review (kept for reference):
      {onRemove && !removing && (
        <button
          onClick={() => setConfirmOpen(true)}
          title="Remove patient"
          style={{ width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:'none', background:'none', padding:0, cursor:'pointer', borderRadius:4 }}
        >
          <Icon name="solar:trash-bin-minimalistic-linear" size={20} color="var(--neutral-300)" />
        </button>
      )}
      {confirmOpen && (
        <ConfirmDialog
          icon="solar:trash-bin-minimalistic-linear"
          title="Remove Patient?"
          description="This Patient will be removed from this Pop group and will need to be added back manually."
          confirmLabel="Remove Patient"
          cancelLabel="Cancel"
          variant="error"
          onConfirm={doRemove}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
      */}
    </div>
  );
}

/* Search field above the list — type to find patients from the DB and add them. */
export function AddPatientSearch({ matched, onAdd }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const have = new Set(matched.map(m => String(m.id).toUpperCase()));
  const ql = q.trim().toLowerCase();
  const results = FOLD_DB
    .filter(p => !have.has(String(p.id).toUpperCase()) && (!ql || p.name.toLowerCase().includes(ql) || String(p.id).toLowerCase().includes(ql)))
    .slice(0, 50);
  return (
    <div ref={ref} style={{ position:'relative', flexShrink:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, height:36, padding:'0 10px', border:'0.5px solid var(--neutral-200)', borderRadius:6, background:'var(--neutral-0)' }}>
        <Icon name="solar:magnifer-linear" size={15} color="var(--neutral-300)" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search and Add Patients"
          style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:14, fontFamily:'Inter, sans-serif', color:'var(--neutral-400)' }}
        />
      </div>
      {open && results.length > 0 && (
        <div className="thin-scroll" style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, maxHeight:240, overflowY:'auto', background:'var(--neutral-0)', border:'0.5px solid var(--neutral-150)', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.10)', zIndex:2300, padding:4 }}>
          {results.map(p => (
            <div
              key={p.id}
              onClick={() => { onAdd(p); setQ(''); }}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'8px', borderRadius:4, cursor:'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--neutral-50)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width:32, height:32, borderRadius:8, background:'var(--primary-50)', border:'0.5px solid var(--primary-200)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:13, color:'var(--primary-300)' }}>
                {(p.name || '').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:500, color:'var(--neutral-400)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
                <div style={{ fontSize:12, color:'var(--neutral-200)', whiteSpace:'nowrap' }}>{p.id} • {fmtAge(p.dob)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* All-members-matched review state (Figma 2023:9479) — file preview + matched/extracted list.
   - heading: section title (review = "All Members Matched…", edit = "Extracted Patients")
   - onReupload: when omitted, the file-preview replace icon is hidden (edit mode)
   - onRemoveMember: enables the hover × remove action on each row
   - onAddMember: shows a "Search and Add Patients" field above the list */
export function AllMatchedPanel({ matched, uploadFile, onReupload, heading = 'All Members Matched; Review Pop Group', onRemoveMember, onAddMember }) {
  // edit phase 2 — search disabled in the Create review (kept for reference):
  // const [query, setQuery] = useState('');
  // const q = query.trim().toLowerCase();
  // const shown = q ? matched.filter(m => (m.name || '').toLowerCase().includes(q) || String(m.id).toLowerCase().includes(q)) : matched;
  const shown = matched;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, fontFamily:'Inter, sans-serif', width:'100%', height:'100%', minHeight:0, boxSizing:'border-box', paddingTop:4 }}>
      <p style={{ margin:0, fontSize:16, fontWeight:500, lineHeight:1.2, color:'var(--neutral-500)', flexShrink:0 }}>File Processing Summary</p>

      {uploadFile && (
        <FilePreviewCard fileName={uploadFile.name} sizeMB={(uploadFile.size/1048576).toFixed(1)} onReplace={onReupload} />
      )}

      {/* edit phase 2 — "Search and Add Patients" disabled in the Create review (kept for reference):
      {onAddMember && <AddPatientSearch matched={matched} onAdd={onAddMember} />}
      */}

      {/* edit phase 2 — search of added patients disabled in the Create review (kept for reference):
      <div style={{ display:'flex', alignItems:'center', gap:8, height:36, padding:'0 10px', border:'0.5px solid var(--neutral-200)', borderRadius:6, background:'var(--neutral-0)', flexShrink:0 }}>
        <Icon name="solar:magnifer-linear" size={15} color="var(--neutral-300)" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search Patients"
          style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:14, fontFamily:'Inter, sans-serif', color:'var(--neutral-400)' }}
        />
      </div>
      */}

      {/* Review / extracted list — hugs its content; caps at the drawer bottom and scrolls internally */}
      <div style={{ border:'0.5px solid var(--neutral-150)', borderRadius:8, background:'var(--neutral-0)', overflow:'hidden', width:'100%', flex:'0 1 auto', minHeight:0, display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', alignItems:'center', gap:4, padding:'8px 12px', borderBottom:'0.5px solid var(--neutral-150)', background:'linear-gradient(90deg, var(--status-success-light) 0%, var(--neutral-0) 100%)', flexShrink:0 }}>
          <span style={{ fontSize:14, fontWeight:500, color:'var(--neutral-400)', lineHeight:1.2 }}>Review Population Group</span>
          <Badge label={String(matched.length)} style={{ background:'var(--status-success)', color:'var(--neutral-0)', borderColor:'var(--status-success)' }} />
        </div>

        {/* Member rows — hugs content; scrolls only when the card hits the drawer bottom */}
        <div className="thin-scroll" style={{ flex:'0 1 auto', minHeight:0, overflowY:'auto' }}>
          {shown.map((p, i) => (
            <MatchedRow key={p.id || i} p={p} isLast={i === shown.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function NewModePanel({ matchSummary, uploadFile, csvAllClear, onReupload, matchedHeading, onRemoveMember, onAddMember }) {
  // All entries matched — show review state. In edit mode (matchedHeading set) always
  // show the extracted list, even if empty, rather than the "couldn't read file" card.
  if (csvAllClear && (matchSummary.matched.length > 0 || matchedHeading)) {
    return <AllMatchedPanel matched={matchSummary.matched} uploadFile={uploadFile} onReupload={onReupload} heading={matchedHeading} onRemoveMember={onRemoveMember} onAddMember={onAddMember} />;
  }

  // Has errors — show download panel
  const hasIssues = matchSummary.notFound.length > 0 || matchSummary.duplicates.length > 0;
  if (!uploadFile) return null;

  // File present but nothing parsed (empty / unreadable / wrong columns) — never render blank.
  if (!hasIssues && matchSummary.matched.length === 0) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'12px 0', fontFamily:'Inter, sans-serif', width:'100%', boxSizing:'border-box' }}>
        <p style={{ margin:0, fontSize:16, fontWeight:500, lineHeight:1.2, color:'var(--neutral-500)' }}>File Processing Summary</p>
        <FilePreviewCard fileName={uploadFile.name} sizeMB={(uploadFile.size/1048576).toFixed(1)} onReplace={onReupload} />
        <div style={{ border:'0.5px solid rgba(215,40,37,0.4)', borderRadius:12, padding:48, display:'flex', flexDirection:'column', gap:16, alignItems:'center', background:'linear-gradient(162.29deg, var(--status-error-light) 1.82%, var(--neutral-0) 61.18%)' }}>
          <FileErrorIllustration />
          <p style={{ margin:0, fontSize:14, lineHeight:1.4, color:'var(--neutral-400)', textAlign:'center' }}>
            We couldn't read any patient records from this file. Ensure it's a <strong>CSV</strong> with
            {' '}<strong>Patient ID, First Name, Last Name, DOB</strong> columns, then reupload.
          </p>
          <Button variant="secondary" size="L" leadingIcon="solar:refresh-linear" onClick={onReupload}>Reupload File</Button>
        </div>
      </div>
    );
  }

  const downloadErrorFile = () => {
    // Build HTML-based Excel with colored rows
    const allRows = [
      ['Patient ID', 'First Name', 'Last Name', 'Date of Birth', 'Status'],
      ...matchSummary.matched.map(p => [p.id, p.name?.split(' ')[0]||'', p.name?.split(' ').slice(1).join(' ')||'', p.dob, 'Matched']),
      ...matchSummary.notFound.map(e => [e.rawId, e.rawFn, e.rawLn, e.rawDob, 'Incorrect']),
      ...matchSummary.duplicates.map(e => [e.rawId, e.rawFn, e.rawLn, e.rawDob, 'Duplicate']),
    ];

    const notFoundIds = new Set(matchSummary.notFound.map(e => e.rawId));
    const dupIds      = new Set(matchSummary.duplicates.map(e => e.rawId));

    const headerStyle = 'background:#3a485f;color:#fff;font-weight:600;padding:6px 10px;border:1px solid #ccc;';
    const matchStyle  = 'background:#fff;padding:6px 10px;border:1px solid #e0e0e0;';
    const errorStyle  = 'background:#fff5f5;padding:6px 10px;border:1px solid #fca5a5;';
    const errorIdStyle= 'background:#991b1b;color:#fff;font-weight:600;padding:6px 10px;border:1px solid #991b1b;';
    const dupStyle    = 'background:#fefce8;padding:6px 10px;border:1px solid #fde68a;';

    const colHeaders = ['Patient ID','First Name','Last Name','Date of Birth','Status'];
    let html = '<table border="1" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;">';
    html += '<tr>' + colHeaders.map(h => `<td style="${headerStyle}">${h}</td>`).join('') + '</tr>';

    for (const row of allRows.slice(1)) {
      const rawId = row[0];
      const isError = notFoundIds.has(rawId);
      const isDup   = dupIds.has(rawId);
      if (isError) {
        html += '<tr>';
        html += `<td style="${errorIdStyle}">${row[0]}</td>`;
        html += `<td style="${errorStyle}">${row[1]}</td>`;
        html += `<td style="${errorStyle}">${row[2]}</td>`;
        html += `<td style="${errorStyle}">${row[3]}</td>`;
        html += `<td style="${errorStyle}">${row[4]}</td>`;
        html += '</tr>';
      } else if (isDup) {
        html += '<tr>' + row.map(c=>`<td style="${dupStyle}">${c||''}</td>`).join('') + '</tr>';
      } else {
        html += '<tr>' + row.map(c=>`<td style="${matchStyle}">${c||''}</td>`).join('') + '</tr>';
      }
    }
    html += '</table>';

    const blob = new Blob([`<html><body>${html}</body></html>`], { type:'application/vnd.ms-excel' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'patient-list-errors.xls';
    a.click();
    URL.revokeObjectURL(url);
  };

  /* Reset back to the freshly-selected CSV-upload state (filter stays selected,
     drawer collapses to single column, upload dropzone reappears under the field). */
  const reuploadFile = () => { onReupload?.(); };

  return (
    /* Frame 1433:10239 — py-12, gap-8, column, items-start */
    <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'12px 0', fontFamily:'Inter, sans-serif', width:'100%', boxSizing:'border-box' }}>

      {/* Heading 1433:10241 — Inter Medium 16 / var(--neutral-500) / lh 1.2 */}
      <div style={{ display:'flex', alignItems:'center', width:'100%' }}>
        <p style={{ margin:0, flex:'1 0 0', minWidth:0, fontSize:16, fontWeight:500, lineHeight:1.2, color:'var(--neutral-500)', wordBreak:'break-word' }}>
          File Processing Summary
        </p>
      </div>

      {/* Card 1433:10244 — 0.5px red-40% border, p-64, rounded-12, gap-16, centered, red→white gradient */}
      <div style={{
        width:'100%', boxSizing:'border-box',
        border:'0.5px solid rgba(215,40,37,0.4)', borderRadius:12, padding:64,
        display:'flex', flexDirection:'column', gap:16, alignItems:'center',
        background:'linear-gradient(162.29deg, var(--status-error-light) 1.82%, var(--neutral-0) 61.18%)',
      }}>

        {/* Illustration 1433:10245 — 80px */}
        <FileErrorIllustration />

        {/* Body 1433:10246 — 14 / var(--neutral-400) / lh 1.2 / center */}
        <p style={{ margin:0, width:'100%', fontSize:14, lineHeight:1.2, color:'var(--neutral-400)', textAlign:'center', wordBreak:'break-word' }}>
          Your file has entries with{' '}
          <span style={{ color:'var(--status-error)', fontWeight:500 }}>incorrect</span>{' '}
          <span style={{ color:'var(--status-error)', fontWeight:500 }}>details</span>{' '}
          or{' '}
          <span style={{ color:'var(--status-warning)', fontWeight:500 }}>duplicate</span>{' '}
          <span style={{ color:'var(--status-warning)', fontWeight:500 }}>entries</span>.
          {' '}These are flagged in red and yellow respectively in a file ready to download below. Please download, correct entries, and re-upload here to create a population group.
        </p>

        {/* Buttons row 1433:10247 — gap-12, justify-center, full width */}
        <div style={{ display:'flex', gap:12, justifyContent:'center', alignItems:'flex-start', width:'100%' }}>
          <Button variant="primary" size="L" leadingIcon="solar:download-minimalistic-linear" onClick={downloadErrorFile}>Download File with Errors</Button>
          <Button variant="secondary" size="L" leadingIcon="solar:refresh-linear" onClick={reuploadFile}>Reupload File</Button>
        </div>
      </div>
    </div>
  );
}
