/**
 * PopulationGroupsView.jsx — Fold Health · Population Groups panel
 * Ported from the Pop-group-creation-via-file-upload prototype.
 * antd → Fold Input/Textarea · xlsx → built-in CSV parser · solar-icon-set → Fold <Icon>.
 */

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { Badge } from '../../components/Badge/Badge';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { UpdatePopGroupDrawer } from './UpdatePopGroupDrawer';
import { Input as FoldInput } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { Avatar } from '../../components/Avatar/Avatar';
import { Drawer } from '../../components/Drawer/Drawer';
import { SearchIconButton } from '../../components/SearchIconButton/SearchIconButton';
import { Link } from '../../components/Link/Link';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { HeaderCell } from '../../components/HeaderCell/HeaderCell';
import { useTableSort } from '../../components/HeaderCell/useTableSort';

import SectionAccordion   from './components/SectionAccordion.jsx';
import FileChipCard        from './components/FileChipCard.jsx';
import { TableIcon, MiniCloseIcon, Spinner, ReplaceIcon, FileErrorIllustration } from './components/icons.jsx';
import PaginationBar       from './components/PaginationBar.jsx';
import { FOLD_DB, FOLD_DB_MAP, loadFoldDbFromRows } from './data/fold-db.js';
import { supabase } from '../../lib/supabase';
import { parseXlsxDate, fmtAge } from './data/formatters.js';
import { parseXlsxArrayBuffer } from './xlsxLite.js';
import { useAppStore } from '../../store/useAppStore';
import './popgroups.css';

/* ── antd shims → Fold components (keeps original <Input>/<Input.TextArea>/<ConfigProvider> call-sites) ── */
const Input = (props) => <FoldInput {...props} />;
Input.TextArea = ({ rows = 3, ...props }) => <Textarea rows={rows} {...props} />;
const ConfigProvider = ({ children }) => <>{children}</>;

/* ── solar-icon-set → Fold <Icon> wrappers (same call signature: size, color, style) ── */
const mkIcon = (name) => ({ size = 16, color = 'currentColor', style }) => (
  <Icon name={name} size={size} color={color} style={style} />
);
const AddSquareLinear            = mkIcon('solar:add-square-linear');
const AltArrowDownLinear         = mkIcon('solar:alt-arrow-down-linear');
const CloseCircleLinear          = mkIcon('solar:close-circle-linear');
const DangerCircleLinear         = mkIcon('solar:danger-circle-linear');
const InfoCircleLinear           = mkIcon('solar:info-circle-linear');
const MagniferLinear             = mkIcon('solar:magnifer-linear');
const UsersGroupRoundedLinear    = mkIcon('solar:users-group-rounded-linear');

/* Bulk-select icon — matches Settings → Content (icon between search and filter) */
function BulkSelectIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5.33333 19.2672C5.60948 19.2672 5.83333 19.0434 5.83333 18.7672C5.83333 18.4911 5.60948 18.2672 5.33333 18.2672V18.7672V19.2672ZM18.1667 5.23276C18.1667 5.5089 18.3905 5.73276 18.6667 5.73276C18.9428 5.73276 19.1667 5.5089 19.1667 5.23276H18.6667H18.1667ZM10.6378 12.9816C10.4528 12.7766 10.1367 12.7604 9.93166 12.9454C9.72667 13.1305 9.71047 13.4466 9.89549 13.6516L10.2667 13.3166L10.6378 12.9816ZM12.0199 15.2592L12.3911 14.9242V14.9242L12.0199 15.2592ZM13.6525 15.3008L14.0056 15.6548V15.6548L13.6525 15.3008ZM18.3531 11.3196C18.5486 11.1246 18.549 10.808 18.3541 10.6125C18.1591 10.4169 17.8425 10.4165 17.6469 10.6115L18 10.9655L18.3531 11.3196ZM12 5.23276V5.73276H15.3333V5.23276V4.73276H12V5.23276ZM22 11.6983H21.5V15.5345H22H22.5V11.6983H22ZM15.3333 22V21.5H12V22V22.5H15.3333V22ZM5.33333 15.5345H5.83333V11.6983H5.33333H4.83333V15.5345H5.33333ZM12 22V21.5C10.4149 21.5 9.27493 21.499 8.40708 21.3858C7.55207 21.2744 7.03698 21.062 6.65774 20.6942L6.30964 21.0531L5.96155 21.4121C6.55862 21.9911 7.31736 22.2522 8.27778 22.3774C9.22535 22.501 10.4424 22.5 12 22.5V22ZM5.33333 15.5345H4.83333C4.83333 17.0439 4.83221 18.2277 4.96011 19.1504C5.09023 20.089 5.36234 20.8309 5.96155 21.4121L6.30964 21.0531L6.65774 20.6942C6.28064 20.3285 6.06459 19.8351 5.95064 19.013C5.83446 18.175 5.83333 17.073 5.83333 15.5345H5.33333ZM22 15.5345H21.5C21.5 17.073 21.4989 18.175 21.3827 19.013C21.2687 19.8351 21.0527 20.3285 20.6756 20.6942L21.0237 21.0531L21.3718 21.4121C21.971 20.8309 22.2431 20.089 22.3732 19.1504C22.5011 18.2277 22.5 17.0439 22.5 15.5345H22ZM15.3333 22V22.5C16.891 22.5 18.108 22.501 19.0556 22.3774C20.016 22.2522 20.7747 21.9911 21.3718 21.4121L21.0237 21.0531L20.6756 20.6942C20.2964 21.062 19.7813 21.2744 18.9263 21.3858C18.0584 21.499 16.9184 21.5 15.3333 21.5V22ZM15.3333 5.23276V5.73276C16.9184 5.73276 18.0584 5.73376 18.9263 5.84692C19.7813 5.9584 20.2964 6.17074 20.6756 6.53854L21.0237 6.17961L21.3718 5.82068C20.7747 5.24163 20.016 4.98054 19.0556 4.85531C18.108 4.73176 16.891 4.73276 15.3333 4.73276V5.23276ZM22 11.6983H22.5C22.5 10.1889 22.5011 9.00503 22.3732 8.0824C22.2431 7.14378 21.971 6.40182 21.3718 5.82068L21.0237 6.17961L20.6756 6.53854C21.0527 6.90426 21.2687 7.39769 21.3827 8.21972C21.4989 9.05774 21.5 10.1598 21.5 11.6983H22ZM12 5.23276V4.73276C10.4424 4.73276 9.22535 4.73176 8.27778 4.85531C7.31736 4.98054 6.55862 5.24163 5.96155 5.82068L6.30964 6.17961L6.65774 6.53854C7.03698 6.17074 7.55207 5.9584 8.40708 5.84692C9.27493 5.73376 10.4149 5.73276 12 5.73276V5.23276ZM5.33333 11.6983H5.83333C5.83333 10.1598 5.83446 9.05774 5.95064 8.21972C6.06459 7.39769 6.28064 6.90426 6.65774 6.53854L6.30964 6.17961L5.96155 5.82068C5.36234 6.40182 5.09023 7.14378 4.96011 8.0824C4.83221 9.00503 4.83333 10.1889 4.83333 11.6983H5.33333ZM10.8889 2V2.5H15.3333V2V1.5H10.8889V2ZM2 15.5345H2.5V10.6207H2H1.5V15.5345H2ZM2 15.5345H1.5C1.5 17.6104 3.23079 19.2672 5.33333 19.2672V18.7672V18.2672C3.75398 18.2672 2.5 17.0294 2.5 15.5345H2ZM15.3333 2V2.5C16.9127 2.5 18.1667 3.73783 18.1667 5.23276H18.6667H19.1667C19.1667 3.15688 17.4359 1.5 15.3333 1.5V2ZM10.8889 2V1.5C8.80748 1.5 7.19762 1.499 5.94748 1.66201C4.68449 1.82669 3.71344 2.16668 2.95365 2.90354L3.30175 3.26247L3.64984 3.6214C4.1918 3.09579 4.9192 2.80455 6.07677 2.65361C7.2472 2.501 8.78004 2.5 10.8889 2.5V2ZM2 10.6207H2.5C2.5 8.57421 2.50113 7.09119 2.65798 5.95973C2.81262 4.84425 3.11003 4.14493 3.64984 3.6214L3.30175 3.26247L2.95365 2.90354C2.19172 3.64248 1.83825 4.59035 1.66745 5.82241C1.49887 7.03848 1.5 8.60333 1.5 10.6207H2ZM10.2667 13.3166L9.89549 13.6516L11.6488 15.5942L12.0199 15.2592L12.3911 14.9242L10.6378 12.9816L10.2667 13.3166ZM13.6525 15.3008L14.0056 15.6548L18.3531 11.3196L18 10.9655L17.6469 10.6115L13.2995 14.9467L13.6525 15.3008ZM12.0199 15.2592L11.6488 15.5942C12.2682 16.2805 13.3514 16.3072 14.0056 15.6548L13.6525 15.3008L13.2995 14.9467C13.049 15.1965 12.6263 15.1848 12.3911 14.9242L12.0199 15.2592Z" fill="currentColor"/>
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

function GroupName({ name }) {
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
function DrawerSelect({ value, onChange, options, placeholder, disabled = false, hint }) {
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
function CellOuter({ err, children }) {
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

function FigmaMatchedSection({ patients, expanded, onToggle, allDone }) {
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
const TABLE_TH_STYLE = {
  padding: '8px 16px', fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)',
  borderBottom: '0.5px solid var(--neutral-150)', background: 'var(--neutral-0)',
  position: 'sticky', top: 0, zIndex: 2, textAlign: 'left',
  whiteSpace: 'nowrap', userSelect: 'none',
};
const TABLE_TD_STYLE = { padding: '12px 16px', fontSize: 14, fontWeight: 400, color: 'var(--neutral-300)', verticalAlign: 'middle' };

function FigmaIncorrectRow({ row, onAdd, onRemove, isLast, onToast, matchedIds }) {
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
            <input value={foldId} onChange={e => handleFoldIdChange(e.target.value)} style={FIGMA_INCORRECT_INPUT_ST} />
          </CellOuter>
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: '2px 12px 8px' }}>
          <CellOuter err={mismatch.firstName}>
            <input disabled value={firstName} style={{ ...FIGMA_INCORRECT_INPUT_ST, background:'var(--neutral-50)', color:'var(--neutral-150)', cursor:'not-allowed' }} />
          </CellOuter>
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: '2px 12px 8px' }}>
          <CellOuter err={mismatch.lastName}>
            <input disabled value={lastName} style={{ ...FIGMA_INCORRECT_INPUT_ST, background:'var(--neutral-50)', color:'var(--neutral-150)', cursor:'not-allowed' }} />
          </CellOuter>
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: '2px 12px 8px' }}>
          <CellOuter err={mismatch.dob}>
            <input disabled value={dob} style={{ ...FIGMA_INCORRECT_INPUT_ST, background:'var(--neutral-50)', color:'var(--neutral-150)', cursor:'not-allowed' }} />
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

function FigmaIncorrectSection({ entries, expanded, onToggle, onAdd, onRemove, onToast, matchedIds }) {
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

function FigmaDuplicateSection({ entries, matched, expanded, onToggle, onRemove }) {
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

function PreviewPanel({ patients, onBack }) {
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
function FilePreviewCard({ fileName, sizeMB, onReplace }) {
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

function MatchedRow({ p, isLast, onRemove }) {
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
function AddPatientSearch({ matched, onAdd }) {
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
function AllMatchedPanel({ matched, uploadFile, onReupload, heading = 'All Members Matched; Review Pop Group', onRemoveMember, onAddMember }) {
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

function NewModePanel({ matchSummary, uploadFile, csvAllClear, onReupload, matchedHeading, onRemoveMember, onAddMember }) {
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

/* ─── Population Groups — view ───────────────────────────────────────────── */
/**
 * reclassifyDuplicate — called when a user removes one entry from a duplicate pair.
 * If the sibling (other entry with same rawId) is now alone, it moves it to
 * `matched` (if the Patient ID is valid + fields correct) or `notFound` (otherwise).
 */
function reclassifyDuplicate(prev, removedEntryId) {
  const removed   = prev.duplicates.find(d => d.entryId === removedEntryId);
  const remaining = prev.duplicates.filter(d => d.entryId !== removedEntryId);
  const sibling   = removed ? remaining.find(d => d.rawId === removed.rawId) : null;

  if (!sibling) return { ...prev, duplicates: remaining };

  // Sibling is now alone — reclassify
  const newDups = remaining.filter(d => d.rawId !== sibling.rawId);
  const dbPat   = FOLD_DB_MAP[(sibling.rawId || '').toUpperCase()];

  if (!dbPat) {
    return { ...prev, duplicates: newDups, notFound: [...prev.notFound, { ...sibling, entryId: 'nf_' + sibling.entryId }] };
  }
  const [dbFn, ...rest] = (dbPat.name || '').toLowerCase().split(' ');
  const dbLn = rest.join(' ');
  const fnOk = sibling.rawFn?.trim().toLowerCase() === dbFn;
  const lnOk = sibling.rawLn?.trim().toLowerCase() === dbLn;
  const dobOk = !dbPat.dob || sibling.rawDob === dbPat.dob;

  if (fnOk && lnOk && dobOk) {
    return { ...prev, duplicates: newDups, matched: [...prev.matched, { id: dbPat.id, name: dbPat.name, dob: dbPat.dob, mrn: dbPat.id, pcp: dbPat.pcp }] };
  }
  return { ...prev, duplicates: newDups, notFound: [...prev.notFound, { ...sibling, entryId: 'nf_' + sibling.entryId }] };
}

function PopulationGroupsView({ activeFilter, onToggleSidebar, onMiniBarOpen, miniBarExpandRef, miniBarCloseRef, onModalClose, onBackdropChange, onGroupCreated, onUploadError, onMemberAdded }) {
  /* ── Supabase-backed groups (see supabase/population_groups_migration.sql) ── */
  const popGroups      = useAppStore(s => s.popGroups);
  const fetchPopGroups = useAppStore(s => s.fetchPopGroups);
  const createPopGroup = useAppStore(s => s.createPopGroup);
  const updatePopGroup = useAppStore(s => s.updatePopGroup);
  useEffect(() => { fetchPopGroups(); }, [fetchPopGroups]);

  /* Load the real patient directory (all_patients) so CSV uploads are matched
     against the DB rather than the bundled seed. Prefers dob when present;
     falls back gracefully if the column doesn't exist yet. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let { data, error } = await supabase.from('all_patients').select('id,name,dob,pcp');
      if (error) ({ data, error } = await supabase.from('all_patients').select('id,name,pcp'));
      if (!cancelled && !error && data?.length) loadFoldDbFromRows(data);
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── table state ── */
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [checkedRows,   setCheckedRows]   = useState(new Set());
  const [hoveredRow,    setHoveredRow]    = useState(null);
  const [popPage,       setPopPage]       = useState(1);
  const [popPageSize,   setPopPageSize]   = useState(10);
  const [popGoToInput,  setPopGoToInput]  = useState('');

  /* ── modal state ── */
  const [modalOpen,     setModalOpen]     = useState(false);
  const [segmentName,   setSegmentName]   = useState('');
  const [description,   setDescription]   = useState('');
  const [chosenFilter,  setChosenFilter]  = useState('');
  const [filterDDOpen,  setFilterDDOpen]  = useState(false);
  const [memberStatus,  setMemberStatus]  = useState('All Status');
  const [memDDOpen,     setMemDDOpen]     = useState(false);

  /* ── CSV upload state ── */
  const [dragOver,           setDragOver]           = useState(false);
  const [uploadFile,         setUploadFile]         = useState(null);
  const [showCloseConfirm,   setShowCloseConfirm]   = useState(false);
  const [uploadState,   setUploadState]   = useState('idle'); // idle|uploading|loading|complete
  const [uploadPct,     setUploadPct]     = useState(0);
  const [procStep,      setProcStep]      = useState(0);       // 0-3 steps completed

  /* ── summary / resolution ── */
  const [matchSummary,  setMatchSummary]  = useState({ matched:[], notFound:[], duplicates:[] });
  const [matchedExp,    setMatchedExp]    = useState(false);
  const [notFoundExp,   setNotFoundExp]   = useState(true);
  const [dupExp,        setDupExp]        = useState(true);
  const [manualSel,     setManualSel]     = useState({});

  /* Auto-expand Matched Members once all incorrect/duplicate entries are resolved */
  useEffect(() => {
    if (matchSummary.notFound.length === 0 && matchSummary.duplicates.length === 0 && matchSummary.matched.length > 0) {
      setMatchedExp(true);
    }
  }, [matchSummary.notFound.length, matchSummary.duplicates.length, matchSummary.matched.length]);
  const [patDDOpen,     setPatDDOpen]     = useState(null);
  const [patDDRect,     setPatDDRect]     = useState(null); // position for fixed portal dropdown
  const [showPreview,   setShowPreview]   = useState(false); // final preview before save
  const [patSearch,     setPatSearch]     = useState('');

  /* ── dynamic criteria ── */
  const [criteria,      setCriteria]      = useState([{ attr:'Age', op:'≥', val:'' }]);

  /* ── collapsed mini-bar (now owned by the persistent store/host) ── */

  const startPgSession  = useAppStore(s => s.startPgSession);
  const expandPgSession = useAppStore(s => s.expandPgSession);
  const closePgSession  = useAppStore(s => s.closePgSession);
  const pgSession       = useAppStore(s => s.pgSession);
  const pgReopenToken   = useAppStore(s => s.pgReopenToken);
  const showToast       = useAppStore(s => s.showToast);

  /* ── dev toggle ── */
  const [showDevButtons, setShowDevButtons] = useState(false);
  /* tableMode / smartMode / enhancedMode / tableRows / tableRowsRef removed (dead code) */

  /* ── new "Download Errors" Create Group flow ── */
  const [newMode,      setNewMode]      = useState(false);
  /* ── edit flow (editing a saved static-CSV group) ── */
  const [editGroupId,  setEditGroupId]  = useState(null);
  const [editBaseline, setEditBaseline] = useState(null); // signature of the loaded group — drives dirty state
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  /* edit phase 2 — new "Update Population Group" drawer (replaces the in-create edit reuse) */
  const [editingGroup, setEditingGroup] = useState(null);

  const fileInputRef  = useRef(null);
  const filterDDRef   = useRef(null);
  const memDDRef      = useRef(null);
  const parsedRef        = useRef(null); // stores parsed match results while loading timer runs
  const loadingStartRef  = useRef(null); // timestamp when loading began (for mini-bar hand-off)

  /* ── close dropdowns on outside click ── */
  useEffect(() => {
    const handler = e => {
      if (filterDDRef.current && !filterDDRef.current.contains(e.target)) setFilterDDOpen(false);
      if (memDDRef.current   && !memDDRef.current.contains(e.target))    setMemDDOpen(false);
      if (!e.target.closest?.('[data-patdd]')) setPatDDOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── loading → sequential steps → complete ── */
  useEffect(() => {
    if (uploadState !== 'loading') { setProcStep(0); return; }
    loadingStartRef.current = Date.now();
    setProcStep(0);
    if (parsedRef.current) {
      setMatchSummary(parsedRef.current);
      parsedRef.current = null;
    }
    /* tableRowsRef removed */
    // Advance each step sequentially; complete after 30 s
    const t1 = setTimeout(() => setProcStep(1),  8000);
    const t2 = setTimeout(() => setProcStep(2), 18000);
    const t3 = setTimeout(() => setProcStep(3), 28000);
    const t4 = setTimeout(() => setUploadState('complete'), 30000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [uploadState]);

  /* ── tell App when the drawer backdrop should show (for off-screen rendering) ── */
  useEffect(() => {
    onBackdropChange?.(modalOpen);
  }, [modalOpen]);

  /* ── reopen the drawer at the completed summary when the mini-bar is expanded ── */
  useEffect(() => {
    if (!pgReopenToken) return;
    const s = useAppStore.getState().pgSession;
    if (!s) return;
    resetModalState();
    setNewMode(true);
    setChosenFilter('static-csv');
    setSegmentName(s.segName || '');
    setUploadFile({ name: s.fileName, size: s.fileSize });
    setMatchSummary(s.result || { matched: [], notFound: [], duplicates: [] });
    setUploadState('complete');
    setModalOpen(true);
    closePgSession();
  }, [pgReopenToken]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── helpers ── */
  const resetModalState = () => {
    /* tableMode / smartMode / enhancedMode / tableRows cleared here — state removed */
    setNewMode(false); setEditGroupId(null);
    setSegmentName(''); setDescription(''); setChosenFilter('');
    setMemberStatus('All Status'); setUploadFile(null);
    setUploadState('idle'); setUploadPct(0); setDragOver(false);
    setCriteria([{ attr:'Age', op:'≥', val:'' }]);
    setMatchedExp(false);
    setNotFoundExp(true); setDupExp(true);
    setManualSel({}); setPatDDOpen(null); setShowPreview(false);
    setMatchSummary({ matched:[], notFound:[], duplicates:[] }); setPatSearch('');
    parsedRef.current = null;
  };
  const openModal = () => { resetModalState(); setModalOpen(true); };
  const openNewModal = () => { resetModalState(); setNewMode(true); setModalOpen(true); };
  /* Edit a saved static-CSV group: reopen the matched/complete drawer with its members. */
  /* ── edit phase 2 ──────────────────────────────────────────────────────────
     The edit flow is being rebuilt as a dedicated "Update Population Group"
     drawer (<UpdatePopGroupDrawer>). The old approach reused the create
     drawer's CSV review state — kept here, commented out, for reference. */
  const openEditModal = (group) => {
    setEditingGroup(group);
  };
  // const openEditModal = (group) => {
  //   resetModalState();
  //   setNewMode(true);
  //   setEditGroupId(group.id);
  //   setSegmentName(group.name || '');
  //   setDescription(group.description || '');
  //   setChosenFilter('static-csv');
  //   setMemberStatus(group.memberStatus || 'All Status');
  //   const members = (group.memberIds || [])
  //     .map(id => FOLD_DB_MAP[String(id).toUpperCase()])
  //     .filter(Boolean)
  //     .map(p => ({ id: p.id, name: p.name, dob: p.dob, mrn: p.id, pcp: p.pcp }));
  //   setUploadFile({ name: group.fileName || `${group.name || 'patient-list'}.csv`, size: 0 });
  //   setMatchSummary({ matched: members, notFound: [], duplicates: [] });
  //   setUploadState('complete');
  //   setEditBaseline(groupSignature({
  //     name: group.name || '',
  //     description: group.description || '',
  //     memberStatus: group.memberStatus || 'All Status',
  //     memberIds: members.map(m => m.id),
  //   }));
  //   setModalOpen(true);
  // };
  /* openTableModal / openSmartModal / openEnhancedModal removed */
  const closeModal = () => {
    setModalOpen(false); setUploadState('idle'); setShowSaveConfirm(false); setEditBaseline(null); onModalClose?.();
  };

  /* Persist the current group (insert on create, update on edit). Returns true on success. */
  const saveGroup = async () => {
    const groupType = chosenFilter === 'dynamic' ? 'Dynamic' : 'Static';
    const newName = segmentName.trim();
    const memberIds = matchSummary.matched.flatMap(m => m.id ? [m.id] : []);
    const payload = {
      name: newName, description: description.trim(), type: groupType,
      filterType: chosenFilter || null, memberStatus, memberIds,
      count: previewPatients.length || matchSummary.matched.length, inactive: 0,
    };
    const saved = editGroupId ? await updatePopGroup(editGroupId, payload) : await createPopGroup(payload);
    if (!saved) return false;   // DB error — keep drawer open, toast already shown
    onGroupCreated?.(newName);
    showToast(editGroupId ? 'Population Group Updated Successfully' : 'Population Group Added Successfully');
    closeModal();
    return true;
  };

  const handleFile = file => {
    if (!file) return;
    /* ── Validate file size (max 5 MB) ── */
    if (file.size > 5 * 1024 * 1024) {
      onUploadError?.('Error! File Size Too Large');
      return;
    }
    setUploadFile(file); setUploadState('uploading'); setUploadPct(0);
    setMatchSummary({ matched:[], notFound:[], duplicates:[] });
    setManualSel({}); setShowPreview(false); parsedRef.current = null;

    /* ── Animate progress over ~5 s (≈2–4 % per 200 ms tick) ── */
    const startTime = Date.now();
    let pct = 0;
    const iv = setInterval(() => {
      pct += Math.random() * 3 + 1;
      if (pct >= 100) { clearInterval(iv); setUploadPct(100); }
      else setUploadPct(Math.round(pct));
    }, 200);

    const isXlsx = /\.xlsx$/i.test(file.name || '');
    const reader = new FileReader();
    reader.onload = async e => {
      /* ── Parse immediately; store in ref. .xlsx → unzip+inflate reader, else CSV/HTML-table text ── */
      try {
        const rows = isXlsx ? await parseXlsxArrayBuffer(e.target.result) : parseTable(e.target.result);
        if (rows.length) {
          const headers   = rows[0].map(h => String(h).toLowerCase());
          const idColIdx  = headers.findIndex(h => h.includes('patient') || h.includes('id'));
          const nameColIdx= headers.findIndex(h => h.includes('name') && !h.includes('first') && !h.includes('last'));
          const fnColIdx  = headers.findIndex(h => h.includes('first'));
          const lnColIdx  = headers.findIndex(h => h.includes('last'));
          const dobColIdx = headers.findIndex(h => h.includes('dob') || h.includes('birth') || h.includes('date'));
          const col       = idColIdx >= 0 ? idColIdx : 0;
          const nameCol   = nameColIdx >= 0 ? nameColIdx : -1;
          const fnCol     = fnColIdx  >= 0 ? fnColIdx  : -1;
          const lnCol     = lnColIdx  >= 0 ? lnColIdx  : -1;
          const dobCol    = dobColIdx >= 0 ? dobColIdx : -1;

          /* Pre-scan: count occurrences per rawId so we know which are duplicates */
          const idCount = new Map();
          rows.slice(1).forEach(row => {
            const rawId = String(row[col] || '').trim();
            if (rawId) idCount.set(rawId, (idCount.get(rawId) || 0) + 1);
          });

          /* Classify rows: IDs with count > 1 ALL go to duplicates (even if invalid).
             After one duplicate is removed, the remaining entry is reclassified.         */
          const seen = new Map();
          const matched = [], notFound = [], duplicates = [];
          let nfIdx = 0, dupIdx = 0;
          rows.slice(1).forEach(row => {
            const rawId  = String(row[col] || '').trim();
            let rawFn    = fnCol   >= 0 ? String(row[fnCol]   || '').trim() : '';
            let rawLn    = lnCol   >= 0 ? String(row[lnCol]   || '').trim() : '';
            let rawName  = nameCol >= 0 ? String(row[nameCol] || '').trim() : '';
            if (!rawFn && !rawLn && rawName) { const p = rawName.split(' '); rawFn = p[0]||''; rawLn = p.slice(1).join(' '); }
            if (!rawName) rawName = [rawFn, rawLn].filter(Boolean).join(' ');
            const rawDob = dobCol >= 0 ? parseXlsxDate(row[dobCol]) : '';
            if (!rawId) return;
            const occ = seen.get(rawId) || 0;
            seen.set(rawId, occ + 1);
            const dbPat = FOLD_DB_MAP[rawId.toUpperCase()];
            const isDup = (idCount.get(rawId) || 0) > 1;

            if (isDup) {
              /* All occurrences of a duplicated ID go to duplicates section */
              duplicates.push({ entryId:`dup${++dupIdx}`, rawId, rawName: rawName || rawId, rawFn, rawLn, rawDob, dbPat });
            } else if (!dbPat) {
              notFound.push({ entryId:`nf${++nfIdx}`, rawId, rawName: rawName || rawId, rawFn, rawLn, rawDob });
            } else {
              const dbParts = (dbPat.name || '').toLowerCase().split(' ');
              const dbFn = dbParts[0] || '';
              const dbLn = dbParts.slice(1).join(' ');
              const fnOk  = rawFn.trim().toLowerCase() === dbFn;
              const lnOk  = rawLn.trim().toLowerCase() === dbLn;
              /* Validate dob only when the DB carries it; otherwise match on id+name. */
              const dobOk = !dbPat.dob || rawDob === dbPat.dob;
              if (fnOk && lnOk && dobOk) {
                matched.push({ id: dbPat.id, name: dbPat.name, dob: dbPat.dob, mrn: dbPat.id, pcp: dbPat.pcp });
              } else {
                notFound.push({ entryId:`nf${++nfIdx}`, rawId, rawName: rawName || rawId, rawFn, rawLn, rawDob });
              }
            }
          });
          parsedRef.current = { matched, notFound, duplicates };

          // Parse into table rows (serial order from Excel)
          const headerRow = rows[0].map(h => String(h).toLowerCase());
          const idIdx    = headerRow.findIndex(h => h.includes('fold') || h.includes('patient') || h.includes('id'));
          const fnIdx    = headerRow.findIndex(h => h.includes('first'));
          const lnIdx    = headerRow.findIndex(h => h.includes('last'));
          const nameIdx  = headerRow.findIndex(h => h.includes('name') && !h.includes('first') && !h.includes('last'));
          const dobIdx   = headerRow.findIndex(h => h.includes('dob') || h.includes('birth') || h.includes('date'));
          const idC  = idIdx  >= 0 ? idIdx  : 0;
          const dobC = dobIdx >= 0 ? dobIdx : -1;

          /* tableRowsRef population removed (tableMode dead code) */
        }
      } catch(err) { console.error('Parse error', err); onUploadError?.('Error! Unable to Upload File'); }

      /* ── Wait until ≥5 s have elapsed, then transition to loading ── */
      clearInterval(iv);
      const elapsed = Date.now() - startTime;
      const delay   = Math.max(0, 5000 - elapsed);
      setTimeout(() => {
        setUploadPct(100);
        setTimeout(() => setUploadState('loading'), 500);
      }, delay);
    };
    if (isXlsx) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  };

  /* Close patient dropdown on outside click */
  useEffect(() => {
    if (!patDDOpen) return;
    const handler = e => {
      if (!e.target.closest('[data-patdd]') && !e.target.closest('[data-patdd-portal]')) {
        setPatDDOpen(null); setPatSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [patDDOpen]);

  const addCriterion    = ()        => setCriteria(p => [...p, { attr:'Age', op:'≥', val:'' }]);
  const removeCriterion = idx       => setCriteria(p => p.filter((_,i) => i !== idx));
  const updateCriterion = (i,k,v)   => setCriteria(p => p.map((c,ci) => ci===i ? { ...c,[k]:v } : c));

  /* ── filtered list ── */
  const activeType = activeFilter === 'Static' || activeFilter === 'Dynamic' ? activeFilter : null;
  const displayedGroups = [...popGroups, ...POP_GROUPS].filter(g => {
    if (activeType && g.type !== activeType) return false;
    if (searchQuery && !g.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }).map(g => ({
    ...g,
    /* numeric keys so date columns sort chronologically (display stays formatted) */
    _createdTs: Date.parse(g.created) || 0,
    _updatedTs: Date.parse(g.updated) || 0,
  }));

  /* Client-side sorting for member counts + dates — same hook TOC/HCC use */
  const { sorted: sortedGroups, sortKey: pgSortKey, sortDir: pgSortDir, requestSort: pgRequestSort } = useTableSort(displayedGroups);

  /* ── pagination ── */
  const totalGroups  = sortedGroups.length;
  const popTotalPages = Math.max(1, Math.ceil(totalGroups / popPageSize));
  const safePg       = Math.min(popPage, popTotalPages);
  const pagedGroups  = sortedGroups.slice((safePg - 1) * popPageSize, safePg * popPageSize);

  /* reset to page 1 whenever filter/search changes */
  useEffect(() => { setPopPage(1); }, [activeFilter, searchQuery, pgSortKey, pgSortDir]);

  const buildPopPages = () => {
    if (popTotalPages <= 7) return Array.from({ length: popTotalPages }, (_, i) => i + 1);
    if (safePg <= 4)        return [1, 2, 3, 4, 5, '...', popTotalPages];
    if (safePg >= popTotalPages - 3) return [1, '...', popTotalPages-4, popTotalPages-3, popTotalPages-2, popTotalPages-1, popTotalPages];
    return [1, '...', safePg - 1, safePg, safePg + 1, '...', popTotalPages];
  };

  const isCsvMode    = chosenFilter === 'static-csv';
  const canCreate    = segmentName.trim() && chosenFilter && (chosenFilter !== 'static-csv' || uploadState === 'complete');
  /* Edit mode: only "dirty" once name/description/status/members differ from the loaded group. */
  const isDirty      = editGroupId
    ? groupSignature({ name: segmentName, description, memberStatus, memberIds: matchSummary.matched.map(m => m.id) }) !== editBaseline
    : true;
  /* Save is enabled only when valid AND (create mode OR an edit actually changed something). */
  const canSave      = canCreate && isDirty;

  /* Header / cell styling — matches the Settings → Account → Users table (AccountPanel.module.css) */
  const unmatchedAll     = [...matchSummary.notFound]; /* duplicates don't block preview */
  const allResolved      = unmatchedAll.length > 0 && unmatchedAll.every(e => manualSel[e.entryId]);
  /* For the grey default CSV flow: Create is only enabled once all incorrect + duplicate entries are dealt with */
  const csvAllClear  = matchSummary.notFound.length === 0 && matchSummary.duplicates.length === 0;
  const canCreatePrimary = canCreate && (
    chosenFilter !== 'static-csv' ||
    (uploadState === 'complete' && csvAllClear) ||  // default CSV flow: all errors cleared
    allResolved ||
    showPreview
  );
  const previewPatients = [
    ...matchSummary.matched.map(p  => ({ ...p, source:'Matched' })),
    ...Object.values(manualSel).map(p => ({ ...p, mrn: p.id || '—', source:'Manual' })),
  ];

  /* ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--neutral-0)', minWidth:0, position:'relative' }}>

      {/* ── Sub-header ── (left padding tuned so the collapse icon's left edge aligns with the table checkbox) */}
      <div style={{ padding:'10px 20px 10px 6px', borderBottom:'0.5px solid var(--neutral-150)', display:'flex', alignItems:'center', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <ActionButton icon="solar:sidebar-minimalistic-linear" size="L" tooltip="Collapse sidebar" iconColor="var(--neutral-300)" onClick={onToggleSidebar} />
          <span style={{ fontSize:16, fontWeight:600, color:'var(--neutral-400)' }}>Population Groups</span>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, marginLeft:'auto' }}>
          {/* ── Search groups — icon expands to a text field on click (same as app-wide search) ── */}
          {searchOpen ? (
            <Input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onBlur={() => { if (!searchQuery.trim()) setSearchOpen(false); }}
              placeholder="Search groups..."
              style={{ width: 220 }}
            />
          ) : (
            <SearchIconButton title="Search groups" onClick={() => setSearchOpen(true)} />
          )}

          <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />

          {/* ── Dev-mode toggle (experimental flows) — disabled for now ──
          <button
            onClick={() => setShowDevButtons(v => !v)}
            title={showDevButtons ? 'Hide experimental flows' : 'Show experimental flows'}
            style={{ width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', border:`0.5px solid ${showDevButtons ? 'var(--primary-200)' : 'var(--neutral-150)'}`, borderRadius:6, background: showDevButtons ? 'var(--primary-50)' : 'var(--neutral-0)', cursor:'pointer', transition:'all 0.15s', flexShrink:0 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 1h4M5 1v5L2 12h10L9 6V1" stroke={showDevButtons ? 'var(--primary-300)' : 'var(--neutral-200)'} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="5.5" cy="9.5" r="0.8" fill={showDevButtons ? 'var(--primary-300)' : 'var(--neutral-200)'}/>
              <circle cx="8" cy="10.5" r="0.6" fill={showDevButtons ? 'var(--primary-300)' : 'var(--neutral-200)'}/>
            </svg>
          </button>
          */}

          {/* ── Create Group — opens the file-upload workflow (error card / all-matched review) ── */}
          <Button variant="secondary" size="L" leadingIcon="solar:add-circle-linear" onClick={openNewModal}>Create Group</Button>

          <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />

          {/* Import Rule — neutral button, no icon */}
          <Button variant="secondary" size="L">Import Rule</Button>

          <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />

          {/* Bulk actions icon — matches Settings → Content bulk-select icon (neutral-300) */}
          <ActionButton size="L" tooltip="Bulk actions" style={{ color: 'var(--neutral-300)' }}><BulkSelectIcon /></ActionButton>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="thin-scroll" style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Inter, sans-serif', minWidth:900 }}>
          <thead>
            <tr>
              <th style={{ ...TABLE_TH_STYLE, width:36, padding:'8px 10px' }}>
                <Checkbox checked={false} aria-label="Select all" />
              </th>
              {[
                { label:'Group Name' },
                { label:'Active Members', sortKey:'count' },
                { label:'Inactive Members', sortKey:'inactive' },
                { label:'Type' },
                { label:'Created Date', sortKey:'_createdTs', w:160 },
                { label:'Updated Date', sortKey:'_updatedTs', w:160 },
                { label:'Action' },
              ].map(col => (
                <HeaderCell
                  key={col.label}
                  label={col.label}
                  sortKey={col.sortKey}
                  activeKey={pgSortKey}
                  activeDir={pgSortDir}
                  onSort={pgRequestSort}
                  style={{ ...TABLE_TH_STYLE, width: col.w ? col.w : undefined }}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedGroups.map((g, idx) => {
              const isChecked = checkedRows.has(g.id);
              const isHov    = hoveredRow === g.id;
              return (
                <tr key={g.id}
                  onMouseEnter={() => setHoveredRow(g.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ borderBottom:'0.5px solid var(--neutral-100)', background: isHov ? 'var(--primary-25)' : 'var(--neutral-0)', transition:'background 0.1s', cursor:'pointer' }}>

                  {/* checkbox */}
                  <td style={{ padding:'12px 10px', verticalAlign:'middle' }} onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => setCheckedRows(prev => { const n=new Set(prev); n.has(g.id)?n.delete(g.id):n.add(g.id); return n; })}
                      aria-label={`Select ${g.name}`}
                    />
                  </td>

                  {/* name + avatar */}
                  <td style={TABLE_TD_STYLE}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                      <Avatar variant="patient" initials={<UsersGroupRoundedLinear size={16} color="var(--primary-300)" />} />
                      <GroupName name={g.name} />
                    </div>
                  </td>

                  {/* active members */}
                  <td style={TABLE_TD_STYLE}>{g.count != null ? g.count : '–'}</td>

                  {/* inactive members */}
                  <td style={TABLE_TD_STYLE}>{g.inactive != null ? g.inactive : '–'}</td>

                  {/* type */}
                  <td style={TABLE_TD_STYLE}>{g.type}</td>

                  {/* created date */}
                  <td style={{ ...TABLE_TD_STYLE, whiteSpace:'nowrap', width:160 }}>{g.created}</td>

                  {/* updated date */}
                  <td style={{ ...TABLE_TD_STYLE, whiteSpace:'nowrap', width:160 }}>{g.updated}</td>

                  {/* actions */}
                  <td style={{ padding:'0 12px', verticalAlign:'middle' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:0 }}>
                      {/* Run */}
                      <ActionButton icon="solar:bolt-linear" size="L" tooltip="Run Automation" iconColor="var(--neutral-300)" />
                      <div style={{ width:1, height:16, background:'var(--neutral-150)', margin:'0 4px', flexShrink:0 }} />
                      {/* Edit */}
                      <ActionButton icon="solar:pen-linear" size="L" tooltip="Edit Group" iconColor="var(--neutral-300)" onClick={() => openEditModal(g)} />
                      <div style={{ width:1, height:16, background:'var(--neutral-150)', margin:'0 4px', flexShrink:0 }} />
                      {/* Delete */}
                      <ActionButton icon="solar:trash-bin-minimalistic-linear" size="L" tooltip="Delete Group" iconColor="var(--neutral-300)" />
                      <div style={{ width:1, height:16, background:'var(--neutral-150)', margin:'0 4px', flexShrink:0 }} />
                      {/* More */}
                      <ActionButton icon="solar:menu-dots-linear" size="L" tooltip="More Options" iconColor="var(--neutral-300)" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <PaginationBar
        currentPage={popPage}
        totalPages={popTotalPages}
        safePage={safePg}
        onPageChange={setPopPage}
        pageSize={popPageSize}
        onPageSizeChange={n => { setPopPageSize(n); setPopPage(1); }}
        goToInput={popGoToInput}
        onGoToInputChange={setPopGoToInput}
        onGoToPage={() => {
          const n = parseInt(popGoToInput);
          if (!isNaN(n) && n >= 1 && n <= popTotalPages) { setPopPage(n); setPopGoToInput(''); }
        }}
        buildPages={buildPopPages}
      />

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Create Audience Group modal ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalOpen && (
        <Drawer
          title={editGroupId ? 'Edit Audience Group' : 'Create Audience Group'}
          onClose={() => {
            if (editGroupId) {
              // Edit: confirm only when there are unsaved changes; otherwise just close.
              if (isDirty) setShowSaveConfirm(true);
              else closeModal();
            } else if (isCsvMode && (uploadState === 'loading' || uploadState === 'complete')) {
              setShowCloseConfirm(true);
            } else {
              closeModal();
            }
          }}
          headerRight={(
            <>
              <Button
                variant="primary"
                size="L"
                disabled={!canSave}
                onClick={() => { if (canSave) saveGroup(); }}>
                {editGroupId ? 'Save' : 'Create'}
              </Button>
              <span className="pg-header-divider" />
            </>
          )}
          noCloseDivider
          className={`pg-create-panel${(isCsvMode && (uploadState === 'loading' || uploadState === 'complete')) ? ' pg-create-panel--wide' : ''}`}
          bodyClassName="pg-create-body"
        >

            {/* ── Drawer Body: two-column when CSV + loading/complete, else single col ── */}
            <ConfigProvider theme={{ token: { fontFamily: 'Inter, sans-serif' } }}>
            {/* ConfigProvider end tag is below at the closing of drawer body */}
            {isCsvMode && (uploadState === 'loading' || uploadState === 'complete') ? (
              <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
                {/* LEFT: locked form */}
                <div className="thin-scroll" style={{ width:'clamp(300px, 38%, 460px)', flexShrink:0, overflowY:'auto', padding:'16px', borderRight:'0.5px solid var(--neutral-100)' }}>
                  <div style={{ marginBottom:16 }}>
                    <label style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:5 }}>Create Segment Name <span style={{ color:'var(--status-error)' }}>•</span></label>
                    <Input
                      value={segmentName}
                      onChange={e => setSegmentName(e.target.value)}
                      placeholder="Enter Name"
                      style={{ fontSize:14, color:'var(--neutral-400)', fontFamily:'Inter, sans-serif', width:'100%', border:'0.5px solid var(--neutral-200)' }}
                    />
                  </div>
                  <div style={{ marginBottom:16 }}>
                    <label style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:5 }}>Description</label>
                    <Input.TextArea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Enter Description"
                      style={{ fontSize:14, color:'var(--neutral-400)', fontFamily:'Inter, sans-serif', resize:'none', border:'0.5px solid var(--neutral-200)' }}
                    />
                  </div>
                  <div style={{ marginBottom:16 }}>
                    <label style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:5 }}>Choose Filter <span style={{ color:'var(--status-error)' }}>•</span></label>
                    <DrawerSelect
                      value={chosenFilter}
                      onChange={val => { setChosenFilter(val); setUploadFile(null); setUploadState('idle'); setCriteria([{ attr:'Age', op:'≥', val:'' }]); }}
                      placeholder="Choose Filter"
                      options={FILTER_OPTIONS}
                    />
                  </div>
                  <div style={{ marginBottom:16 }}>
                    <label style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:5 }}>Frequency <span style={{ color:'var(--status-error)' }}>•</span></label>
                    <DrawerSelect
                      value="one-time"
                      onChange={() => {}}
                      disabled
                      options={[{ value:'one-time', label:'One Time' }]}
                      hint="Preset & fixed for Static CSV filter."
                    />
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:5 }}>Current Membership Status</label>
                    <DrawerSelect
                      value={memberStatus}
                      onChange={val => setMemberStatus(val)}
                      placeholder="Select Current Membership Status"
                      options={MEMBERSHIP_OPTS.map(o => ({ value:o, label:o }))}
                    />
                  </div>
                </div>

                {/* RIGHT: loading animation OR summary */}
                {uploadState === 'loading' ? (
                  /* Loading animation panel */
                  <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', padding:'16px', overflow:'hidden' }}>
                    {uploadFile && (
                      <div style={{ marginBottom:16 }}>
                        <FilePreviewCard
                          fileName={uploadFile.name}
                          sizeMB={(uploadFile.size/1048576).toFixed(1)}
                          onReplace={() => { setUploadFile(null); setUploadState('idle'); setUploadPct(0); setMatchSummary({ matched:[], notFound:[], duplicates:[] }); setManualSel({}); parsedRef.current = null; }}
                        />
                      </div>
                    )}
                    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20 }}>
                      <div style={{ position:'relative', width:80, height:80 }}>
                        <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'3px solid var(--primary-100)', borderTopColor:'var(--primary-300)', borderRightColor:'var(--primary-200)', animation:'pg-spin 1s linear infinite' }} />
                        <div style={{ position:'absolute', inset:11, borderRadius:'50%', border:'2px solid transparent', borderBottomColor:'var(--primary-200)', animation:'pg-spin-rev 1.5s linear infinite' }} />
                        <div style={{ position:'absolute', inset:22, borderRadius:'50%', background:'var(--primary-100)', display:'flex', alignItems:'center', justifyContent:'center', animation:'pg-pulse 2s ease-in-out infinite' }}>
                          <TableIcon color="var(--primary-300)" size={16} />
                        </div>
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:14, fontWeight:600, color:'var(--neutral-400)', marginBottom:4 }}>Processing your file…</div>
                        <div style={{ fontSize:14, color:'var(--neutral-300)', lineHeight:1.6 }}>Uploading and validating your patient list</div>
                      </div>
                      <div style={{ width:220, height:4, background:'var(--primary-100)', borderRadius:2, overflow:'hidden', position:'relative' }}>
                        <div style={{ position:'absolute', height:'100%', width:'45%', background:'linear-gradient(90deg, transparent, var(--primary-300), var(--primary-200), transparent)', borderRadius:2, animation:'pg-progress 1.8s ease-in-out infinite' }} />
                      </div>
                      <div style={{ fontSize:14, color:'var(--neutral-200)', textAlign:'center', lineHeight:1.6 }}>You can minimize this window and<br/>continue working while it processes.</div>
                      <Button
                        variant="secondary"
                        size="L"
                        leadingIcon="solar:minimize-square-linear"
                        onClick={() => {
                          startPgSession({
                            fileName: uploadFile?.name || '',
                            fileSize: uploadFile?.size || 0,
                            segName: segmentName,
                            status: 'loading',
                            procStep,
                            startedAt: loadingStartRef.current || Date.now(),
                            result: parsedRef.current || matchSummary,
                          });
                          resetModalState();
                          setModalOpen(false);
                        }}>
                        Minimize
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Summary panel — default flow */
                  <div className="thin-scroll" style={{ flex:1, minWidth:0, overflowY:'auto', padding:'16px' }}>
                    {newMode ? (
                      <NewModePanel
                        matchSummary={matchSummary}
                        uploadFile={uploadFile}
                        csvAllClear={csvAllClear}
                        matchedHeading={editGroupId ? 'Extracted Patients' : undefined}
                        onReupload={editGroupId ? undefined : (() => { setUploadFile(null); setUploadState('idle'); setUploadPct(0); setMatchSummary({ matched:[], notFound:[], duplicates:[] }); setManualSel({}); parsedRef.current = null; })}
                        onRemoveMember={(p) => setMatchSummary(prev => ({ ...prev, matched: prev.matched.filter(m => m.id !== p.id) }))}
                        onAddMember={(p) => setMatchSummary(prev => prev.matched.some(m => String(m.id) === String(p.id))
                          ? prev
                          : ({ ...prev, matched: [...prev.matched, { id: p.id, name: p.name, dob: p.dob, mrn: p.id, pcp: p.pcp }] }))}
                      />
                    ) : (
                      <>
                        {/* ── File Processing Summary heading ── */}
                        {!showPreview && (
                          <div style={{ fontSize:14, fontWeight:500, color:'var(--neutral-400)', marginBottom:10 }}>File Processing Summary</div>
                        )}

                        {/* ── Info banner (Figma 1921-9782) — above file chip, hidden on Review Pop Group ── */}
                        {!showPreview && uploadFile && !csvAllClear && (
                          <div style={{ background:'var(--status-info-light)', border:'0.5px solid rgba(20,94,204,0.2)', borderRadius:4, padding:6, marginBottom:8, display:'flex', alignItems:'flex-start', gap:4 }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0, marginTop:1 }}>
                              <circle cx="8" cy="8" r="7" stroke="var(--status-info)" strokeWidth="1.2"/>
                              <path d="M8 7v4" stroke="var(--status-info)" strokeWidth="1.4" strokeLinecap="round"/>
                              <circle cx="8" cy="5.5" r="0.7" fill="var(--status-info)"/>
                            </svg>
                            <span style={{ fontSize:12, fontWeight:400, color:'var(--neutral-400)', lineHeight:1.4 }}>
                              Enter correct values for fold ID &amp; match to recommended entries OR Reupload excel with correct data.
                            </span>
                          </div>
                        )}

                        {/* ── File chip (Figma 1921-9783) ── */}
                        {!showPreview && (
                          <FileChipCard
                            uploadFile={uploadFile}
                            onReupload={() => { setUploadFile(null); setUploadState('idle'); setUploadPct(0); setMatchSummary({ matched:[], notFound:[], duplicates:[] }); setManualSel({}); parsedRef.current = null; }}
                          />
                        )}

                        {/* Info banner moved above file chip */}

                        {/* ── Matched Members / Review Pop Group ── */}
                        {!showPreview && (
                          <FigmaMatchedSection
                            patients={matchSummary.matched}
                            expanded={matchedExp}
                            onToggle={() => setMatchedExp(v => !v)}
                            allDone={matchSummary.notFound.length === 0 && matchSummary.duplicates.length === 0 && matchSummary.matched.length > 0}
                          />
                        )}

                        {/* ── Members With Incorrect Details ── */}
                        {matchSummary.notFound.length > 0 && !showPreview && (
                          <FigmaIncorrectSection
                            entries={matchSummary.notFound}
                            expanded={notFoundExp}
                            onToggle={() => setNotFoundExp(v => !v)}
                            onAdd={(entryId, patient) => {
                              setMatchSummary(prev => ({
                                ...prev,
                                matched: [...prev.matched, patient],
                                notFound: prev.notFound.filter(e => e.entryId !== entryId),
                              }));
                              onMemberAdded?.('Member added to Matched Members successfully');
                            }}
                            onRemove={entryId => setMatchSummary(prev => ({
                              ...prev,
                              notFound: prev.notFound.filter(e => e.entryId !== entryId),
                            }))}
                            matchedIds={new Set(matchSummary.matched.map(p => p.id))}
                          />
                        )}

                        {/* ── Duplicate Entries ── */}
                        {matchSummary.duplicates.length > 0 && !showPreview && (
                          <FigmaDuplicateSection
                            entries={matchSummary.duplicates}
                            matched={matchSummary.matched}
                            expanded={dupExp}
                            onToggle={() => setDupExp(v => !v)}
                            onRemove={entryId => setMatchSummary(prev => reclassifyDuplicate(prev, entryId))}
                          />
                        )}

                        {/* ── Action row: Reupload + Preview Pop Group ── */}
                        {/* {!showPreview && (
                          <div style={{ display:'flex', gap:8 }}>
                            <button
                              onClick={() => {
                                setUploadFile(null); setUploadState('idle'); setUploadPct(0);
                                setMatchSummary({ matched:[], notFound:[], duplicates:[] });
                                setManualSel({}); setShowPreview(false); parsedRef.current = null;
                              }}
                              style={{ flex:1, height:34, background:'var(--neutral-0)', color:'var(--neutral-300)', border:'0.5px solid var(--neutral-150)', borderRadius:6, fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'Inter, sans-serif', transition:'background 0.15s', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
                              onMouseEnter={e => e.currentTarget.style.background='var(--neutral-50)'}
                              onMouseLeave={e => e.currentTarget.style.background='var(--neutral-0)'}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>
                              Reupload Document
                            </button>
                            <button
                              disabled={unmatchedAll.length > 0 && !allResolved}
                              onClick={() => setShowPreview(true)}
                              style={{ flex:1, height:34, borderRadius:6, fontSize:14, fontWeight:500, fontFamily:'Inter, sans-serif', transition:'background 0.15s', display:'flex', alignItems:'center', justifyContent:'center', gap:6, border:'none',
                                background: (unmatchedAll.length === 0 || allResolved) ? 'var(--primary-300)' : 'var(--neutral-100)',
                                color:      (unmatchedAll.length === 0 || allResolved) ? 'var(--neutral-0)' : 'var(--neutral-200)',
                                cursor:     (unmatchedAll.length === 0 || allResolved) ? 'pointer' : 'not-allowed',
                              }}
                              onMouseEnter={e => { if (unmatchedAll.length === 0 || allResolved) e.currentTarget.style.background='var(--primary-400)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = (unmatchedAll.length === 0 || allResolved) ? 'var(--primary-300)' : 'var(--neutral-100)'; }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              Preview Pop Group
                            </button>
                          </div>
                        )} */}

                        {/* ══ PREVIEW + SAVE PANEL ══ */}
                        {/* {showPreview && (
                          <PreviewPanel
                            patients={previewPatients}
                            onBack={() => setShowPreview(false)}
                          />
                        )} */}
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* ── Single-column drawer body ── */
              <div className="thin-scroll" style={{ flex:1, overflowY:'auto', padding:'16px' }}>

                  {/* Segment Name */}
                  <div style={{ marginBottom:16 }}>
                    <label style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:6 }}>
                      Create Segment Name <span style={{ color:'var(--status-error)' }}>•</span>
                    </label>
                    <Input
                      value={segmentName}
                      onChange={e => setSegmentName(e.target.value)}
                      placeholder="Enter Name"
                      style={{ width:'100%', fontSize:14, color:'var(--neutral-400)', fontFamily:'Inter, sans-serif', border:'0.5px solid var(--neutral-200)' }}
                    />
                  </div>

                  {/* Description */}
                  <div style={{ marginBottom:16 }}>
                    <label style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:6 }}>Description</label>
                    <Input.TextArea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Enter Description"
                      style={{ fontSize:14, color:'var(--neutral-400)', fontFamily:'Inter, sans-serif', resize:'none', border:'0.5px solid var(--neutral-200)' }}
                    />
                  </div>

                  {/* Choose Filter dropdown */}
                  <div style={{ marginBottom:8 }}>
                    <label style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:6 }}>
                      Choose Filter <span style={{ color:'var(--status-error)' }}>•</span>
                    </label>
                    <DrawerSelect
                      value={chosenFilter}
                      onChange={val => { setChosenFilter(val); setUploadFile(null); setUploadState('idle'); setCriteria([{ attr:'Age', op:'≥', val:'' }]); }}
                      placeholder="Choose Filter"
                      options={FILTER_OPTIONS}
                    />
                  </div>

                  {/* ── Static CSV: Upload Patient List ── */}
                  {chosenFilter === 'static-csv' && (
                    <div style={{ marginBottom:16 }}>
                      <div style={{ border:'0.5px solid var(--neutral-150)', borderRadius:8, overflow:'hidden', background:'var(--neutral-50)' }}>
                        {/* Section header */}
                        <div style={{ padding:'10px 14px', borderBottom:'0.5px solid var(--neutral-100)' }}>
                          <span style={{ fontSize:14, fontWeight:500, color:'var(--neutral-400)' }}>Upload Patient List</span>
                        </div>
                        <div style={{ padding:'12px 14px' }}>
                          {/* Info box */}
                          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'var(--status-info-light)', border:'0.5px solid color-mix(in srgb, var(--status-info) 40%, transparent)', borderRadius:6, marginBottom:12 }}>
                            <InfoCircleLinear size={14} color="var(--status-info)" style={{ flexShrink:0 }} />
                            <span style={{ fontSize:12, color:'var(--status-info)', lineHeight:1.5 }}>
                              Ensure column names match your ID type — use "EHR ID" for EHR IDs or "Fold Contact ID" for Fold Contact IDs.
                            </span>
                          </div>

                          {/* Upload area or uploaded file */}
                          {uploadFile && uploadState === 'uploading' ? (
                            /* File selected — show progress */
                            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', border:'0.5px solid var(--primary-200)', borderRadius:8, background:'var(--primary-50)', marginBottom:10 }}>
                              <Avatar variant="icon" size={28} backgroundColor="var(--primary-100)" borderColor="var(--primary-200)" icon={<TableIcon color="var(--primary-300)" size={16} />} />
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:14, fontWeight:500, color:'var(--neutral-400)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{uploadFile.name}</div>
                                <div style={{ marginTop:6, height:4, background:'var(--neutral-100)', borderRadius:2, overflow:'hidden' }}>
                                  <div style={{ height:'100%', width:`${uploadPct}%`, background: uploadPct < 40 ? 'var(--status-warning)' : 'var(--status-success)', borderRadius:2, transition:'width 0.3s ease, background 0.4s ease' }} />
                                </div>
                                <div style={{ fontSize:12, color:'var(--neutral-200)', marginTop:3 }}>{uploadPct}%</div>
                              </div>
                              <button onClick={() => { setUploadFile(null); setUploadState('idle'); setUploadPct(0); }}
                                style={{ border:'none', background:'none', cursor:'pointer', display:'flex', alignItems:'center', padding:4, borderRadius:4, transition:'background 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background='var(--neutral-75)'}
                                onMouseLeave={e => e.currentTarget.style.background='none'}>
                                <MiniCloseIcon />
                              </button>
                            </div>
                          ) : (
                            /* Drop zone */
                            <div
                              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                              onDragLeave={() => setDragOver(false)}
                              onDrop={e => { e.preventDefault(); setDragOver(false); const f=e.dataTransfer.files[0]; if(f) handleFile(f); }}
                              onClick={() => fileInputRef.current?.click()}
                              style={{ border:`1.5px dashed ${dragOver ? 'var(--primary-300)' : 'var(--neutral-150)'}`, borderRadius:8, padding:'28px 16px', textAlign:'center', cursor:'pointer', background: dragOver ? 'var(--primary-50)' : 'var(--neutral-0)', transition:'all 0.2s', marginBottom:8 }}>
                              <input ref={fileInputRef} type="file" accept=".csv,.xls,.xlsx" style={{ display:'none' }} onChange={e => { const f=e.target.files?.[0]; if(f) handleFile(f); }} />
                              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display:'block', margin:'0 auto' }}>
                                <path d="M3 15c0 2.828 0 4.243.879 5.121C4.757 21 6.172 21 9 21h6c2.828 0 4.243 0 5.121-.879C21 19.243 21 17.828 21 15M12 16V3m0 0 4 4.375M12 3 8 7.375" stroke={dragOver ? 'var(--primary-300)' : 'var(--neutral-300)'} strokeWidth="1"/>
                              </svg>
                              <div style={{ fontSize:14, color:'var(--neutral-300)', marginTop:10 }}>
                                Drag & drop file here or <Link>Choose file</Link>
                              </div>
                            </div>
                          )}
                          {/* format info + template */}
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                            <span style={{ fontSize:12, color:'var(--neutral-200)' }}>Supported formats: CSV, XLS, XLSX &nbsp;•&nbsp; Max size: 5 MB</span>
                            <Link style={{ fontSize:12 }}>Download Template</Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Dynamic: criteria builder ── */}
                  {chosenFilter === 'dynamic' && (
                    <div style={{ marginBottom:14 }}>
                      <div style={{ border:'0.5px solid var(--neutral-150)', borderRadius:8, padding:'12px 14px' }}>
                        <div style={{ fontSize:14, fontWeight:600, color:'var(--neutral-400)', marginBottom:10 }}>Patient Characteristics</div>
                        <div style={{ fontSize:14, color:'var(--neutral-200)', marginBottom:10 }}>Patients matching <strong style={{ color:'var(--neutral-400)' }}>all</strong> conditions below will be included.</div>
                        {criteria.map((c, idx) => {
                          const attrDef = CRIT_ATTRS.find(a => a.label===c.attr) || CRIT_ATTRS[0];
                          return (
                            <div key={idx} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                              <span style={{ fontSize:14, fontWeight:500, color:'var(--neutral-300)', width:24, textAlign:'center', flexShrink:0 }}>{idx===0?'IF':'AND'}</span>
                              <select className="pg-crit-select" value={c.attr} onChange={e => updateCriterion(idx,'attr',e.target.value)}
                                style={{ flex:2, padding:'7px 8px', border:'0.5px solid var(--neutral-150)', borderRadius:6, fontSize:14, color:'var(--neutral-400)', fontFamily:'Inter, sans-serif', background:'var(--neutral-0)', outline:'none' }}>
                                {CRIT_ATTRS.map(a => <option key={a.label} value={a.label}>{a.label}</option>)}
                              </select>
                              <select className="pg-crit-select" value={c.op} onChange={e => updateCriterion(idx,'op',e.target.value)}
                                style={{ flex:1.4, padding:'7px 6px', border:'0.5px solid var(--neutral-150)', borderRadius:6, fontSize:14, color:'var(--neutral-400)', fontFamily:'Inter, sans-serif', background:'var(--neutral-0)', outline:'none' }}>
                                {attrDef.ops.map(op => <option key={op} value={op}>{op}</option>)}
                              </select>
                              {attrDef.type==='select' ? (
                                <select className="pg-crit-select" value={c.val} onChange={e => updateCriterion(idx,'val',e.target.value)}
                                  style={{ flex:2, padding:'7px 6px', border:'0.5px solid var(--neutral-150)', borderRadius:6, fontSize:14, color:'var(--neutral-400)', fontFamily:'Inter, sans-serif', background:'var(--neutral-0)', outline:'none' }}>
                                  <option value="">Select…</option>
                                  {attrDef.opts.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              ) : (
                                <input className="pg-input" value={c.val} onChange={e => updateCriterion(idx,'val',e.target.value)}
                                  placeholder="Value"
                                  style={{ flex:2, padding:'7px 8px', border:'0.5px solid var(--neutral-150)', borderRadius:6, fontSize:14, color:'var(--neutral-400)', fontFamily:'Inter, sans-serif', outline:'none' }} />
                              )}
                              {criteria.length > 1 && (
                                <button onClick={() => removeCriterion(idx)}
                                  style={{ width:24, height:24, border:'none', background:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                  <CloseCircleLinear size={14} color="var(--neutral-200)" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        <button onClick={addCriterion}
                          style={{ fontSize:14, color:'var(--primary-300)', background:'none', border:'none', cursor:'pointer', padding:'4px 0', display:'flex', alignItems:'center', gap:4, fontFamily:'Inter, sans-serif', fontWeight:500, marginTop:2 }}>
                          <AddSquareLinear size={13} color="var(--primary-300)" /> Add Filter
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Frequency (static-csv only, fixed/disabled) */}
                  {chosenFilter === 'static-csv' && (
                    <div style={{ marginBottom:16 }}>
                      <label style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:6 }}>
                        Frequency <span style={{ color:'var(--status-error)' }}>•</span>
                      </label>
                      <DrawerSelect
                        value="one-time"
                        onChange={() => {}}
                        disabled
                        options={[{ value:'one-time', label:'One Time' }]}
                        hint="Frequency is preset & fixed for Static (upload from CSV file) Filter."
                      />
                    </div>
                  )}

                  {/* Fold Membership Status — always visible */}
                  <div style={{ marginBottom:16 }}>
                    <label style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:6 }}>Fold Membership Status</label>
                    <DrawerSelect
                      value={memberStatus}
                      onChange={val => setMemberStatus(val)}
                      placeholder="Select Current Membership Status"
                      options={MEMBERSHIP_OPTS.map(o => ({ value:o, label:o }))}
                    />
                  </div>
            </div>
            )}
            </ConfigProvider>
        </Drawer>
      )}

      {/* ── edit phase 2: Update Population Group drawer ── */}
      {editingGroup && (
        <UpdatePopGroupDrawer
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
          onSubmit={async ({ name, description, members }) => {
            const saved = await updatePopGroup(editingGroup.id, {
              name,
              description,
              type: editingGroup.type || 'Static',
              filterType: 'static-csv',
              memberStatus: editingGroup.memberStatus || 'All Status',
              memberIds: members.map(m => m.id),
              count: members.length,
              inactive: 0,
            });
            if (!saved) return;
            onGroupCreated?.(name);
            showToast('Population Group Updated Successfully');
            setEditingGroup(null);
          }}
        />
      )}

      {/* ── Close-while-uploading confirmation — reuses DeleteConfirmModal visual pattern ── */}
      {showCloseConfirm && (
        <>
              <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.25)', zIndex:10000 }} onClick={() => setShowCloseConfirm(false)} />
              <div
                onClick={e => e.stopPropagation()}
                style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:340, background:'var(--neutral-0)', borderRadius:12, border:'0.5px solid var(--neutral-100)', padding:20, boxShadow:'0 4px 20px rgba(0,0,0,0.14)', zIndex:10001, display:'flex', flexDirection:'column', alignItems:'center', gap:16, fontFamily:'Inter,sans-serif' }}
              >
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, width:'100%' }}>
                  <DangerCircleLinear size={18} color="var(--status-error)" strokeWidth={1} />
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, width:'100%' }}>
                    <span style={{ fontSize:16, fontWeight:500, color:'var(--neutral-400)', textAlign:'center' }}>Quit without saving?</span>
                    <p style={{ fontSize:14, color:'var(--neutral-200)', textAlign:'center', lineHeight:1.5, margin:0 }}>
                      You will need to reupload the file if you quit now. Any progress will be lost.
                    </p>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, width:'100%' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <Button variant="secondary" size="L" fullWidth onClick={() => setShowCloseConfirm(false)}>Cancel</Button>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <Button variant="danger" size="L" fullWidth onClick={() => { setShowCloseConfirm(false); closeModal(); }}>Quit Anyway</Button>
                  </div>
                </div>
              </div>
            </>
          )}

      {/* ── Save-changes confirmation (edit mode, only when dirty) ── */}
      {showSaveConfirm && (
        <>
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.25)', zIndex:10000 }} onClick={() => setShowSaveConfirm(false)} />
          <div
            onClick={e => e.stopPropagation()}
            style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:440, maxWidth:'calc(100vw - 32px)', background:'var(--neutral-0)', borderRadius:12, border:'0.5px solid var(--neutral-100)', padding:20, boxShadow:'0 4px 20px rgba(0,0,0,0.14)', zIndex:10001, display:'flex', flexDirection:'column', gap:16, fontFamily:'Inter,sans-serif' }}
          >
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                <span style={{ fontSize:16, fontWeight:500, color:'var(--neutral-400)' }}>Save Changes ?</span>
                <CloseButton size={20} onClick={() => setShowSaveConfirm(false)} />
              </div>
              <p style={{ margin:0, fontSize:14, color:'var(--neutral-200)', lineHeight:1.5 }}>
                Please confirm to save the changes you made for this population group.
              </p>
            </div>
            <div style={{ display:'flex', gap:8, width:'100%' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <Button variant="secondary" size="L" fullWidth onClick={() => { setShowSaveConfirm(false); closeModal(); }}>Discard</Button>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <Button variant="primary" size="L" fullWidth onClick={() => { setShowSaveConfirm(false); saveGroup(); }}>Save Changes</Button>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

export { PopulationGroupsView };
