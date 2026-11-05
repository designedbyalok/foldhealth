import { useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { TableIcon } from './components/icons.jsx';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { Avatar } from '../../components/Avatar/Avatar';
import './popgroups.css';

const PROC_STEPS = [
  'Reading the uploaded file',
  'Extracting values for processing',
  'Matching Patient IDs with Fold Patients',
];

export function PgProcessingHost() {
  const pgSession        = useAppStore(s => s.pgSession);
  const pgMinimized      = useAppStore(s => s.pgMinimized);
  const updatePgSession  = useAppStore(s => s.updatePgSession);
  const expandPgSession  = useAppStore(s => s.expandPgSession);
  const closePgSession   = useAppStore(s => s.closePgSession);
  const setActivePage    = useAppStore(s => s.setActivePage);
  const setActiveSubnavList = useAppStore(s => s.setActiveSubnavList);

  /* ── Persistent processing simulation ── */
  const timersRef = useRef(null);
  useEffect(() => {
    if (!pgSession || pgSession.status !== 'loading') return;
    if (timersRef.current === pgSession.startedAt) return; // already scheduled for this session
    timersRef.current = pgSession.startedAt;
    const elapsed = () => Date.now() - (pgSession.startedAt || Date.now());
    const rem = (ms) => Math.max(0, ms - elapsed());
    const t = [];
    t.push(setTimeout(() => updatePgSession({ procStep: 1 }), rem(8000)));
    t.push(setTimeout(() => updatePgSession({ procStep: 2 }), rem(18000)));
    t.push(setTimeout(() => updatePgSession({ procStep: 3 }), rem(28000)));
    t.push(setTimeout(() => updatePgSession({ status: 'complete' }), rem(30000)));
    return () => t.forEach(clearTimeout);
  }, [pgSession?.startedAt, pgSession?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pgSession || !pgMinimized) return null;

  const expand = () => { setActivePage('population'); setActiveSubnavList('pg:All'); expandPgSession(); };

  return (
    <div style={{ position:'fixed', bottom:20, right:20, zIndex:3000, animation:'pg-slide-up 0.3s cubic-bezier(0.32,0,0.15,1)' }}>
      {pgSession.status !== 'complete' ? (
        /* Processing */
        <div style={{ background:'var(--neutral-0)', borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,0.15)', border:'0.5px solid var(--neutral-150)', width:400, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderBottom:'0.5px solid var(--neutral-100)' }}>
            <Avatar variant="icon" size={32} backgroundColor="var(--primary-100)" borderColor="var(--primary-200)" icon={<TableIcon color="var(--primary-300)" size={16} />} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize: 'var(--font-base)', fontWeight: 600, color:'var(--neutral-400)' }}>Processing File</div>
              <div style={{ fontSize: 'var(--font-base)', color:'var(--neutral-200)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pgSession.fileName || pgSession.segName || 'New Group'}</div>
            </div>
            <ActionButton icon="solar:maximize-square-linear" tooltip="Expand" onClick={expand} />
          </div>
          <div style={{ padding:'14px 16px' }}>
            {PROC_STEPS.map((step, i) => {
              const done   = (pgSession.procStep ?? 0) > i;
              const active = (pgSession.procStep ?? 0) === i && pgSession.status === 'loading';
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom: i < PROC_STEPS.length-1 ? 12 : 0 }}>
                  {done ? (
                    <div style={{ width:20, height:20, borderRadius:'50%', background:'var(--status-success)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, animation:'pg-step-check 0.25s ease' }}>
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="var(--neutral-0)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  ) : active ? (
                    <div style={{ width:20, height:20, borderRadius:'50%', border:'2px solid var(--primary-300)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--primary-300)', animation:'pg-pulse 1s ease-in-out infinite' }} />
                    </div>
                  ) : (
                    <div style={{ width:20, height:20, borderRadius:'50%', border:'1.5px solid var(--neutral-150)', flexShrink:0 }} />
                  )}
                  <span style={{ fontSize: 'var(--font-base)', color: done?'var(--status-success)' : active?'var(--primary-300)' : 'var(--neutral-200)', fontWeight: (done||active)? 500: 400, transition:'color 0.2s' }}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Done */
        <div style={{ background:'var(--neutral-0)', borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,0.15)', border:'0.5px solid var(--status-success)', width:400, overflow:'hidden', animation:'pg-fade-up 0.3s ease' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderBottom:'0.5px solid var(--status-success-light)', background:'linear-gradient(90deg, var(--status-success-light) 0%, var(--neutral-0) 100%)' }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--status-success)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, animation:'pg-badge-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <svg width="16" height="13" viewBox="0 0 16 13" fill="none"><path d="M1.5 6.5L5.5 10.5L14.5 1.5" stroke="var(--neutral-0)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize: 'var(--font-base)', fontWeight: 600, color:'var(--neutral-400)' }}>File Extracted &amp; Processed</div>
              <div style={{ fontSize: 'var(--font-base)', color:'var(--neutral-300)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pgSession.fileName || pgSession.segName}</div>
            </div>
            <ActionButton icon="solar:close-circle-linear" onClick={() => closePgSession()} />
          </div>
          <div style={{ padding:'14px 16px' }}>
            <Button fullWidth onClick={expand}>Show Summary</Button>
          </div>
        </div>
      )}
    </div>
  );
}
