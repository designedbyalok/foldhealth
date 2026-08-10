import { useId } from 'react';
import { Input as FoldInput } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Avatar } from '../../components/Avatar/Avatar';
import { Link } from '../../components/Link/Link';
import { TableIcon, MiniCloseIcon } from './components/icons.jsx';
import {
  DrawerSelect, InfoCircleLinear, AddSquareLinear, CloseCircleLinear,
} from './PopulationGroupsViewPanels.jsx';
import { FILTER_OPTIONS, MEMBERSHIP_OPTS, CRIT_ATTRS } from './PopulationGroupsView.utils.js';

const Input = (props) => <FoldInput {...props} />;
Input.TextArea = ({ rows = 3, ...props }) => <Textarea rows={rows} {...props} />;

export function PopulationGroupsCreateDrawerForm({ vm }) {
  const uid = useId();
  const {
    segmentName, setSegmentName, description, setDescription,
    chosenFilter, setChosenFilter, memberStatus, setMemberStatus,
    dragOver, setDragOver, uploadFile, setUploadFile,
    uploadState, setUploadState, uploadPct, criteria, setCriteria,
    fileInputRef, handleFile,
    addCriterion, removeCriterion, updateCriterion,
  } = vm;

  return (
              <div className="thin-scroll" style={{ flex:1, overflowY:'auto', padding:'16px' }}>

                  {/* Segment Name */}
                  <div style={{ marginBottom:16 }}>
                    <label style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:6 }} htmlFor={`${uid}-segment-name`}>
                      Create Segment Name <span style={{ color:'var(--status-error)' }}>•</span>
                    </label>
                    <Input
                      id={`${uid}-segment-name`}
                      value={segmentName}
                      onChange={e => setSegmentName(e.target.value)}
                      placeholder="Enter Name"
                      style={{ width:'100%', fontSize:14, color:'var(--neutral-400)', fontFamily:'Inter, sans-serif', border:'0.5px solid var(--neutral-200)' }}
                    />
                  </div>

                  {/* Description */}
                  <div style={{ marginBottom:16 }}>
                    <label style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:6 }} htmlFor={`${uid}-description`}>Description</label>
                    <Input.TextArea
                      id={`${uid}-description`}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Enter Description"
                      style={{ fontSize:14, color:'var(--neutral-400)', fontFamily:'Inter, sans-serif', resize:'none', border:'0.5px solid var(--neutral-200)' }}
                    />
                  </div>

                  {/* Choose Filter dropdown */}
                  <div style={{ marginBottom:8 }}>
                    <span style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:6 }}>
                      Choose Filter <span style={{ color:'var(--status-error)' }}>•</span>
                    </span>
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
                              style={{ border:`1.5px dashed ${dragOver ? 'var(--primary-300)' : 'var(--neutral-150)'}`, borderRadius:8, padding:'28px 16px', textAlign:'center', cursor:'pointer', background: dragOver ? 'var(--primary-50)' : 'var(--neutral-0)', transition:'border-color 0.2s, background 0.2s', marginBottom:8 }}>
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
                      <span style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:6 }}>
                        Frequency <span style={{ color:'var(--status-error)' }}>•</span>
                      </span>
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
                    <span style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:6 }}>Fold Membership Status</span>
                    <DrawerSelect
                      value={memberStatus}
                      onChange={val => setMemberStatus(val)}
                      placeholder="Select Current Membership Status"
                      options={MEMBERSHIP_OPTS.map(o => ({ value:o, label:o }))}
                    />
                  </div>
            </div>
  );
}
