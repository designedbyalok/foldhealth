import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Drawer } from '../../components/Drawer/Drawer';
import { Button } from '../../components/Button/Button';
import { Input as FoldInput } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Icon } from '../../components/Icon/Icon';
import { CloseIcon } from '../../components/Icon/CloseIcon';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { FOLD_DB, FOLD_DB_MAP } from './data/fold-db.js';
import { fmtAge } from './data/formatters.js';
import { TableIcon } from './components/icons.jsx';

/* Required-field label */
function Label({ children, required }) {
  return (
    <label style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:6 }}>
      {children}{required && <span style={{ color:'var(--status-error)' }}> *</span>}
    </label>
  );
}

/* Read-only / disabled select-looking box */
function StaticSelect({ value, disabled }) {
  return (
    <div style={{
      height:36, padding:'0 10px', boxSizing:'border-box', display:'flex', alignItems:'center', gap:4,
      border:'0.5px solid var(--neutral-200)', borderRadius:6,
      background: disabled ? 'var(--neutral-50)' : 'var(--neutral-0)',
      fontSize:14, fontFamily:'Inter, sans-serif', cursor:'not-allowed',
    }}>
      <span style={{ flex:1, color: disabled ? 'var(--neutral-200)' : 'var(--neutral-400)' }}>{value}</span>
      <Icon name="solar:alt-arrow-down-linear" size={14} color="var(--neutral-200)" />
    </div>
  );
}

const CHIP_STYLE = { display:'inline-flex', alignItems:'center', gap:6, height:24, padding:'0 6px 0 8px', background:'var(--neutral-50)', border:'0.5px solid var(--neutral-150)', borderRadius:6, fontSize:13, color:'var(--neutral-300)', whiteSpace:'nowrap', flexShrink:0, boxSizing:'border-box' };

/* Single-line patient chips field — type to search; shows as many chips as fit,
   then a "+N" overflow badge directly after the last visible chip. Fixed height. */
function PatientChipsField({ members, onRemove, query, setQuery, open, onOpen, inputRef }) {
  const fieldRef = useRef(null);
  const measureRef = useRef(null);
  const [visible, setVisible] = useState(members.length);
  useLayoutEffect(() => {
    const field = fieldRef.current, meas = measureRef.current;
    if (!field || !meas) return;
    const measure = () => {
      const avail = field.clientWidth - 28; // chevron + padding
      const RESERVE = 96; // room for the +N badge and a little input
      const chips = Array.from(meas.querySelectorAll('[data-chip]'));
      let used = 0, count = 0;
      for (let i = 0; i < chips.length; i++) {
        const w = chips[i].offsetWidth + 6;
        const lastOne = i === chips.length - 1;
        if (used + w > avail - (lastOne ? 0 : RESERVE)) break;
        used += w; count++;
      }
      setVisible(count);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(field);
    return () => ro.disconnect();
  }, [members]);
  const hidden = Math.max(0, members.length - visible);
  return (
    <div
      ref={fieldRef}
      onClick={() => { onOpen(); inputRef.current?.focus(); }}
      style={{ height:36, padding:'0 8px', boxSizing:'border-box', display:'flex', alignItems:'center', gap:6, border:`0.5px solid ${open ? 'var(--primary-300)' : 'var(--neutral-200)'}`, borderRadius:6, background:'var(--neutral-0)', cursor:'text', overflow:'hidden' }}
    >
      {/* hidden measuring layer — all chips, so widths survive across resizes */}
      <div ref={measureRef} aria-hidden="true" style={{ position:'absolute', visibility:'hidden', pointerEvents:'none', display:'flex', gap:6, whiteSpace:'nowrap', height:0, overflow:'hidden' }}>
        {members.map(m => <span key={m.id} data-chip style={CHIP_STYLE}>{m.name}<span style={{ width:14, flexShrink:0 }} /></span>)}
      </div>

      {members.slice(0, visible).map(m => (
        <span key={m.id} style={CHIP_STYLE}>
          {m.name}
          <button onClick={e => { e.stopPropagation(); onRemove(m.id); }} aria-label={`Remove ${m.name}`} style={{ display:'inline-flex', border:'none', background:'none', padding:0, cursor:'pointer' }}>
            <CloseIcon size={14} color="var(--neutral-300)" />
          </button>
        </span>
      ))}
      {hidden > 0 && (
        <span style={{ ...CHIP_STYLE, padding:'0 8px' }}>+{hidden}</span>
      )}
      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={onOpen}
        placeholder={members.length === 0 ? 'Search and Add Patients' : ''}
        style={{ flex:1, minWidth:40, border:'none', outline:'none', background:'transparent', fontSize:14, fontFamily:'Inter, sans-serif', color:'var(--neutral-400)' }}
      />
      <Icon name="solar:alt-arrow-down-linear" size={14} color="var(--neutral-200)" style={{ flexShrink:0 }} />
    </div>
  );
}

/**
 * UpdatePopGroupDrawer — edit-phase-2 drawer for a saved Static (CSV) group.
 * Matches the "Update Population Group" design: segment name, description,
 * (locked) EHR + filter, file preview with download, removable patient chips
 * with an add dropdown, and an automation search placeholder.
 */
export function UpdatePopGroupDrawer({ group, onClose, onSubmit }) {
  const [name, setName]               = useState(group.name || '');
  const [description, setDescription] = useState(group.description || '');
  const [members, setMembers]         = useState(
    () => (group.memberIds || []).flatMap(id => {
      const p = FOLD_DB_MAP[String(id).toUpperCase()];
      return p ? [{ id: p.id, name: p.name, dob: p.dob }] : [];
    }),
  );
  const [patOpen, setPatOpen] = useState(false);
  const [patQuery, setPatQuery] = useState('');
  const patRef = useRef(null);
  const patInputRef = useRef(null);

  useEffect(() => {
    if (!patOpen) return;
    const h = e => { if (!patRef.current?.contains(e.target)) { setPatOpen(false); setPatQuery(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [patOpen]);

  const fileName = group.fileName || `${(group.name || 'patient-list')}.csv`;
  const fileCount = (group.memberIds || []).length; // how many patients came from the uploaded file
  const have = new Set(members.map(m => String(m.id).toUpperCase()));
  const ql = patQuery.trim().toLowerCase();
  // Dropdown shows ALL patients (selected + not) filtered by the field's query;
  // the checkbox reflects selection.
  const options = FOLD_DB
    .filter(p => !ql || p.name.toLowerCase().includes(ql) || String(p.id).toLowerCase().includes(ql))
    .slice(0, 50);

  const removeMember = id => setMembers(prev => prev.filter(m => String(m.id) !== String(id)));
  const toggleMember = p => setMembers(prev => prev.some(m => String(m.id) === String(p.id))
    ? prev.filter(m => String(m.id) !== String(p.id))
    : [...prev, { id: p.id, name: p.name, dob: p.dob }]);

  const downloadFile = () => {
    const header = 'Patient ID,First Name,Last Name,DOB';
    const lines = members.map(m => {
      const [fn, ...rest] = (m.name || '').split(' ');
      return [m.id, fn || '', rest.join(' '), m.dob || ''].join(',');
    });
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName.replace(/\.(xlsx?|csv)$/i, '') + '.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Name is the only genuine requirement. Requiring members too made every
  // group without a CSV member list uneditable — Dynamic groups are defined
  // by a rule and carry none, so their Submit button could never enable and
  // a rename or description edit was impossible to save.
  const canSubmit = Boolean(name.trim());

  return (
    <Drawer
      title="Update Population Group"
      onClose={onClose}
      headerRight={(
        <>
          <Button variant="primary" size="L" disabled={!canSubmit} onClick={() => canSubmit && onSubmit({ name: name.trim(), description: description.trim(), members })}>Submit</Button>
          <span className="pg-header-divider" />
        </>
      )}
      noCloseDivider
      className="pg-create-panel"
      bodyClassName="pg-create-body"
    >
      <div className="thin-scroll" style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:16, fontFamily:'Inter, sans-serif' }}>
        {/* Segment name */}
        <div>
          <Label required>Create Segment Name</Label>
          <FoldInput value={name} onChange={e => setName(e.target.value)} placeholder="Enter Name" style={{ width:'100%', border:'0.5px solid var(--neutral-200)' }} />
        </div>

        {/* Description */}
        <div>
          <Label>Description</Label>
          <Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Enter Description" style={{ resize:'none', border:'0.5px solid var(--neutral-200)' }} />
        </div>

        {/* EHR instance (locked) */}
        <div>
          <Label required>Choose Ehr Instance</Label>
          <StaticSelect value="Elation Montrose" disabled />
        </div>

        {/* Filter (locked to CSV method) + uploaded file preview, 8px apart */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div>
            <Label required>Choose Filter</Label>
            <StaticSelect value="Static (Upload From CSV File)" />
          </div>

          {/* Uploaded file preview — download on the far right */}
          <div style={{ display:'flex', alignItems:'center', gap:16, padding:12, border:'0.5px solid var(--neutral-150)', borderRadius:8, background:'var(--neutral-0)', width:'100%', boxSizing:'border-box' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flex:'1 0 0', minWidth:0 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'var(--neutral-50)', border:'0.5px solid var(--neutral-200)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <TableIcon color="var(--neutral-300)" size={18} />
            </div>
            <div style={{ flex:'1 0 0', minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:500, color:'var(--neutral-400)', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fileName}</div>
              <div style={{ fontSize:14, fontWeight:400, color:'var(--neutral-200)', lineHeight:1.2, marginTop:2 }}>{fileCount} patients added</div>
            </div>
          </div>
          <button onClick={downloadFile} title="Download file"
            style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:'none', background:'none', cursor:'pointer', borderRadius:4, transition:'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background='var(--neutral-75)'}
            onMouseLeave={e => e.currentTarget.style.background='none'}>
            <Icon name="solar:download-minimalistic-linear" size={18} color="var(--neutral-300)" />
          </button>
          </div>
        </div>

        {/* Patients — single-line chips field (type to search) + checkbox dropdown */}
        <div ref={patRef} style={{ position:'relative' }}>
          <Label required>Patients</Label>
          <PatientChipsField members={members} onRemove={removeMember} query={patQuery} setQuery={setPatQuery} open={patOpen} onOpen={() => setPatOpen(true)} inputRef={patInputRef} />

          {patOpen && (
            <div className="thin-scroll" style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:2300, maxHeight:280, overflowY:'auto', background:'var(--neutral-0)', border:'0.5px solid var(--neutral-150)', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.10)', padding:4 }}>
              {options.length === 0 ? (
                <div style={{ padding:'10px', fontSize:13, color:'var(--neutral-200)' }}>No patients found</div>
              ) : options.map(p => {
                const checked = have.has(String(p.id).toUpperCase());
                return (
                  <div key={p.id} onClick={() => toggleMember(p)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:8, borderRadius:4, cursor:'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--neutral-50)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <span onClick={e => e.stopPropagation()} style={{ display:'inline-flex', flexShrink:0 }}>
                      <Checkbox checked={checked} onCheckedChange={() => toggleMember(p)} aria-label={`Select ${p.name}`} />
                    </span>
                    <div style={{ width:32, height:32, borderRadius:8, background:'var(--primary-50)', border:'0.5px solid var(--primary-200)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:13, color:'var(--primary-300)' }}>
                      {(p.name || '').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:500, color:'var(--neutral-400)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize:12, color:'var(--neutral-200)', whiteSpace:'nowrap' }}>{p.id} • {fmtAge(p.dob)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Automation (placeholder) */}
        <div>
          <div style={{ fontSize:14, fontWeight:500, color:'var(--neutral-400)', marginBottom:6 }}>Below automation(s) will execute for this population group</div>
          <div style={{ height:36, padding:'0 10px', boxSizing:'border-box', display:'flex', alignItems:'center', gap:4, border:'0.5px solid var(--neutral-200)', borderRadius:6, background:'var(--neutral-0)' }}>
            <Icon name="solar:magnifer-linear" size={15} color="var(--neutral-300)" />
            <span style={{ flex:1, color:'var(--neutral-200)', fontSize:14 }}>Search Automation</span>
            <Icon name="solar:alt-arrow-down-linear" size={14} color="var(--neutral-200)" />
          </div>
        </div>
      </div>
    </Drawer>
  );
}
