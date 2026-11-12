import { useEffect } from 'react';
import { Avatar } from '../../components/Avatar/Avatar';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { useLiveCall } from './useLiveCall';
import { fillCm, speakerOf, splitHighlight } from './liveCallModel';
import { jumpToLine } from './jumpToLine';
import styles from './LiveCallOverlay.module.css';

/** The transcript as it comes in, newest on top, behind the recording consent gate. */
export function LiveTranscript({ script, cmName }) {
  const { consent, consentAt, shown, held, focus, setConsent, focusItem } = useLiveCall();
  const itemsById = new Map(script.items.map(it => [it.id, it]));
  const listening = consent === 'yes' && !held && shown < script.lines.length;
  const next = listening ? speakerOf(script, script.lines[shown].who, cmName) : null;
  const lines = script.lines.slice(0, consent === 'yes' ? shown : 0).map((l, i) => ({ ...l, i })).reverse();
  const focusLine = focus ? script.lines.findIndex(l => l.item === focus) : -1;

  useEffect(() => { if (focusLine >= 0) jumpToLine(focusLine); }, [focusLine]);

  return (
    <div className={styles.transcriptBody}>

      {consent === 'pending' && (
        <div className={styles.consent} role="region" aria-label="Recording consent">
          <span className={styles.consentIcon}><Icon name="solar:microphone-3-linear" size={24} color="var(--neutral-300)" /></span>
          <span className={styles.consentTitle}>Ask for recording consent</span>
          <span className={styles.consentScript}>“This call is recorded and transcribed for your care record. Is that okay?”</span>
          <span className={styles.consentActions}>
            <Button onClick={() => setConsent(true)}>Agreed, Start Recording</Button>
            <Button variant="outline" onClick={() => setConsent(false)}>Declined</Button>
          </span>
        </div>
      )}

      {consent === 'no' && (
        <div className={styles.declined} role="status">
          <span className={styles.consentTitle}>Not Recording</span>
          <span className={styles.consentText}>Patient declined. Add notes at wrap-up.</span>
        </div>
      )}

      {consent === 'yes' && (
        <div className={styles.consentNote}>
          <Icon name="solar:check-circle-linear" size={14} color="var(--status-success)" />
          Patient agreed to recording at {consentAt}
        </div>
      )}

      <div className={styles.lines}>
        {listening && <div className={styles.speaking}>{next.name.split(' ')[0]} is speaking …</div>}
        {lines.map(l => {
          const who = speakerOf(script, l.who, cmName);
          const text = fillCm(l.text, cmName);
          const { before, mid, after } = splitHighlight(text, l.hl);
          const item = l.item ? itemsById.get(l.item) : null;
          return (
            <div key={l.i} data-ln={l.i} className={[styles.line, focusLine === l.i ? styles.lineFocus : ''].filter(Boolean).join(' ')}>
              <Avatar variant={who.kind === 'staff' ? 'staff' : 'patient'} size={28} initials={who.ini} />
              <div className={styles.lineBody}>
                <span className={styles.lineHead}>
                  <span className={styles.speaker}>{who.name}</span>
                  <span className={styles.role}>{who.role} · {l.t}</span>
                </span>
                <span className={styles.lineText}>{before}{mid && <mark className={styles.mark}>{mid}</mark>}{after}</span>
                {item && (
                  <span>
                    <button type="button" className={styles.created} onClick={() => focusItem(item.id)}>
                      <Icon name={item.icon} size={12} color="currentColor" />
                      Created: {item.type}
                    </button>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
