import { describe, expect, it } from 'vitest';
import { LIVE_CALL_SCRIPTS } from './data/scripts';
import { MODE_COPY, visitScript, acceptCopy, actionItemsView, callRecordFromWrapUp, fallbackScript, fillCm, pointsView, recordingStatus, splitHighlight, summaryPoints, wrapUpDraft } from './liveCallModel';

const script = LIVE_CALL_SCRIPTS[0];
const session = (patch = {}) => ({ accepted: {}, dismissed: {}, edits: {}, filter: 'all', consent: 'yes', held: false, shown: 0, ...patch });

describe('live call model', () => {
  it('points every item and talking point at a line in its script', () => {
    for (const s of [...LIVE_CALL_SCRIPTS, fallbackScript({ name: 'Ann Lee' })]) {
      const ids = new Set(s.items.map(i => i.id));
      expect(s.lines.filter(l => l.item).map(l => l.item).sort()).toEqual([...ids].sort());
      s.lines.filter(l => l.hl).forEach(l => expect(l.text).toContain(l.hl));
      s.points.forEach(p => expect(s.lines[p.line]).toBeTruthy());
    }
  });

  it('raises items only once their line is shown, newest first', () => {
    const v = actionItemsView(script, 5, session());
    expect(v.raised.map(i => i.id)).toEqual(['w1', 'w2']);
    expect(v.visible.map(i => i.id)).toEqual(['w2', 'w1']);
    expect(v.newest).toBe('w2');
  });

  it('filters by state and leaves medication changes out of Accept All', () => {
    const s = session({ accepted: { w1: true }, dismissed: { w3: true } });
    const all = actionItemsView(script, 20, s);
    expect(all.visible.some(i => i.id === 'w3')).toBe(false);
    expect(all.acceptedN).toBe(1);
    expect(actionItemsView(script, 20, { ...s, filter: 'accepted' }).visible.map(i => i.id)).toEqual(['w1']);
    expect(all.bulk.every(i => i.where !== 'Medications')).toBe(true);
    expect(all.bulk.map(i => i.id)).toEqual(['w8', 'w9', 'w5', 'w7']);
  });

  it('covers talking points as the transcript reaches them', () => {
    expect(pointsView(script, 7).done).toBe(1);
    expect(pointsView(script, 7).points[0].at).toBe('Covered at 01:04');
    expect(pointsView(script, 20).done).toBe(6);
  });

  it('words Accept by where the item goes', () => {
    expect(acceptCopy({ where: 'Tasks' }).label).toBe('Accept');
    expect(acceptCopy({ where: 'Medications', src: ['Refill Request', 'Routes to Dr. L. Chen to sign'] })).toMatchObject({ label: 'Send for Signature' });
    expect(acceptCopy({ where: 'Medications', src: ['Reconciled', 'x'] }).label).toBe('Reconcile');
  });

  it('fills the care manager and splits highlights', () => {
    expect(fillCm('this is {cmFirst} ({cm})', 'Robin Bang')).toBe('this is Robin (Robin Bang)');
    expect(splitHighlight('One says furosemide 40.', 'furosemide 40')).toEqual({ before: 'One says ', mid: 'furosemide 40', after: '.' });
    expect(splitHighlight('abc', 'zz').mid).toBe('');
  });

  it('reads the recording status', () => {
    expect(recordingStatus(session({ consent: 'pending' }), 5).tone).toBe('warning');
    expect(recordingStatus(session({ held: true }), 5).label).toBe('On Hold · Transcript Paused');
    expect(recordingStatus(session({ shown: 5 }), 5).label).toBe('Recording · Up to Date');
  });

  it('drafts the wrap-up from what happened on the call', () => {
    const full = wrapUpDraft(script, session({ shown: script.lines.length, accepted: { w5: true }, dismissed: { w7: true } }));
    expect(full.summary).toBe(script.summary);
    expect(full.sources).toEqual(['Live transcript', '1 accepted item']);
    expect(full.accepted.map(i => i.id)).toEqual(['w5']);
    expect(full.pending.map(i => i.id)).not.toContain('w7');

    const early = wrapUpDraft(script, session({ shown: 9 }));
    expect(early.summary).toMatch(/^Call ended before the brief was finished/);
    expect(early.summary).toContain('Covered: Which diuretic he takes (teach-back); Supply of new medications.');
    expect(early.summary).toContain('Not covered: Weight and swelling since discharge');

    expect(wrapUpDraft(script, session({ consent: 'no', shown: 0 }))).toMatchObject({ summary: '', sources: [], recorded: false });
  });

  it('builds the call log record a completed wrap-up saves', () => {
    const s = session({ shown: 3 });
    const accepted = [{ type: 'New Task', title: 'Deliver large-print pill organizer' }];
    const r = callRecordFromWrapUp({ patient: { id: '11143' }, script, session: s, cmName: 'Robin Bang', summary: 'One. Two.', disposition: 'Reached', seconds: 125, endedAt: new Date(2026, 10, 12, 10, 5), accepted });
    expect(r).toMatchObject({ patientId: '11143', callType: 'completed', agentName: 'Robin Bang', isBot: false, outcome: 'Reached', duration: '02:05', startedAt: '11/12/2026 10:02', endedAt: '11/12/2026 10:05' });
    expect(r.callSummary).toEqual({ summary: 'One. Two.', keyPoints: ['One.', 'Two.'], actionItems: ['New Task: Deliver large-print pill organizer'] });
    expect(r.callTranscript).toHaveLength(3);
    expect(r.callTranscript[0]).toMatchObject({ name: 'Robin Bang', sender: 'agent', time: '00:03' });
    expect(r.callTranscript[0].text).toContain('this is Robin,');
    expect(summaryPoints('Weight 186 lb. Up 4 lb.')).toEqual(['Weight 186 lb.', 'Up 4 lb.']);
  });

  it('turns a phone script into an in-person visit', () => {
    const v = visitScript(script, { name: 'William Davis' });
    expect(v.lines[0].text).toBe('Hi William, thanks for coming in. I’ll keep the recorder on so I can focus on you.');
    expect(v.lines.slice(1)).toEqual(script.lines.slice(1));
    expect(v.interpreter).toBe('In room · English');
    expect(MODE_COPY.visit.outcomes).toEqual(['Completed', 'Ended Early', 'Recording Declined']);
  });

  it('reads a paused visit and a dropped call in the status', () => {
    expect(recordingStatus(session({ held: true, mode: 'visit' }), 5).label).toBe('Recording Paused');
    expect(recordingStatus(session({ dropped: { at: 42 } }), 5)).toMatchObject({ label: 'Call Dropped', tone: 'danger' });
  });

  it('records a visit as in person', () => {
    const r = callRecordFromWrapUp({ patient: { id: '1' }, script, session: session({ mode: 'visit' }), cmName: 'A', summary: '', disposition: 'Completed', seconds: 60 });
    expect(r.direction).toBe('in-person');
  });
});
