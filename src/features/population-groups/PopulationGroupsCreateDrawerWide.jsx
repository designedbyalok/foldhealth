import { useId } from 'react';
import { Input as FoldInput } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Button } from '../../components/Button/Button';
import { TableIcon } from './components/icons.jsx';
import { DrawerSelect, FilePreviewCard } from './PopulationGroupsViewPanels.jsx';
import { FILTER_OPTIONS, MEMBERSHIP_OPTS } from './PopulationGroupsView.utils.js';
import { PopulationGroupsCreateDrawerSummary } from './PopulationGroupsCreateDrawerSummary.jsx';

const Input = (props) => <FoldInput {...props} />;
Input.TextArea = ({ rows = 3, ...props }) => <Textarea rows={rows} {...props} />;

export function PopulationGroupsCreateDrawerWide({ vm, onMemberAdded }) {
  const uid = useId();
  const {
    segmentName, setSegmentName, description, setDescription,
    chosenFilter, setChosenFilter, memberStatus, setMemberStatus,
    uploadFile, setUploadFile, uploadState, setUploadState, uploadPct, setUploadPct,
    matchSummary, setMatchSummary, setCriteria,
    procStepRef, manualSelRef, parsedRef, loadingStartRef,
    startPgSession, resetModalState, setModalOpen,
  } = vm;

  return (
              <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
                {/* LEFT: locked form */}
                <div className="thin-scroll" style={{ width:'clamp(300px, 38%, 460px)', flexShrink:0, overflowY:'auto', padding:'16px', borderRight:'0.5px solid var(--neutral-100)' }}>
                  <div style={{ marginBottom:16 }}>
                    <label style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:5 }} htmlFor={`${uid}-segment-name`}>Create Segment Name <span style={{ color:'var(--status-error)' }}>•</span></label>
                    <Input
                      id={`${uid}-segment-name`}
                      value={segmentName}
                      onChange={e => setSegmentName(e.target.value)}
                      placeholder="Enter Name"
                      style={{ fontSize:14, color:'var(--neutral-400)', fontFamily:'Inter, sans-serif', width:'100%', border:'0.5px solid var(--neutral-200)' }}
                    />
                  </div>
                  <div style={{ marginBottom:16 }}>
                    <label style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:5 }} htmlFor={`${uid}-description`}>Description</label>
                    <Input.TextArea
                      id={`${uid}-description`}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Enter Description"
                      style={{ fontSize:14, color:'var(--neutral-400)', fontFamily:'Inter, sans-serif', resize:'none', border:'0.5px solid var(--neutral-200)' }}
                    />
                  </div>
                  <div style={{ marginBottom:16 }}>
                    <span style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:5 }}>Choose Filter <span style={{ color:'var(--status-error)' }}>•</span></span>
                    <DrawerSelect
                      value={chosenFilter}
                      onChange={val => { setChosenFilter(val); setUploadFile(null); setUploadState('idle'); setCriteria([{ attr:'Age', op:'≥', val:'' }]); }}
                      placeholder="Choose Filter"
                      options={FILTER_OPTIONS}
                    />
                  </div>
                  <div style={{ marginBottom:16 }}>
                    <span style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:5 }}>Frequency <span style={{ color:'var(--status-error)' }}>•</span></span>
                    <DrawerSelect
                      value="one-time"
                      onChange={() => {}}
                      disabled
                      options={[{ value:'one-time', label:'One Time' }]}
                      hint="Preset & fixed for Static CSV filter."
                    />
                  </div>
                  <div>
                    <span style={{ display:'block', fontSize:14, fontWeight:400, color:'var(--neutral-200)', marginBottom:5 }}>Current Membership Status</span>
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
                          onReplace={() => { setUploadFile(null); setUploadState('idle'); setUploadPct(0); setMatchSummary({ matched:[], notFound:[], duplicates:[] }); manualSelRef.current = {}; parsedRef.current = null; }}
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
                            procStep: procStepRef.current,
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
                  <PopulationGroupsCreateDrawerSummary vm={vm} onMemberAdded={onMemberAdded} />
                )}
              </div>
  );
}
