import FileChipCard from './components/FileChipCard.jsx';
import {
  NewModePanel, FigmaMatchedSection, FigmaIncorrectSection, FigmaDuplicateSection,
} from './PopulationGroupsViewPanels.jsx';

export function PopulationGroupsCreateDrawerSummary({ vm, onMemberAdded }) {
  const {
    matchSummary, setMatchSummary, uploadFile, setUploadFile, uploadState, setUploadState, uploadPct, setUploadPct,
    matchedExp, setMatchedExp, notFoundExp, setNotFoundExp, dupExp, setDupExp,
    showPreview, newMode, editGroupId, csvAllClear, manualSelRef, parsedRef,
    reclassifyDuplicate,
  } = vm;

  return (
                  /* Summary panel — default flow */
                  <div className="thin-scroll" style={{ flex:1, minWidth:0, overflowY:'auto', padding:'16px' }}>
                    {newMode ? (
                      <NewModePanel
                        matchSummary={matchSummary}
                        uploadFile={uploadFile}
                        csvAllClear={csvAllClear}
                        matchedHeading={editGroupId ? 'Extracted Patients' : undefined}
                        onReupload={editGroupId ? undefined : (() => { setUploadFile(null); setUploadState('idle'); setUploadPct(0); setMatchSummary({ matched:[], notFound:[], duplicates:[] }); manualSelRef.current = {}; parsedRef.current = null; })}
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
                            onReupload={() => { setUploadFile(null); setUploadState('idle'); setUploadPct(0); setMatchSummary({ matched:[], notFound:[], duplicates:[] }); manualSelRef.current = {}; parsedRef.current = null; }}
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
                                manualSelRef.current = {}; setShowPreview(false); parsedRef.current = null;
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
  );
}
