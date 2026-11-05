export function buildSeedHccActivityFeed() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  // Older first: we reverse at the end so newest sorts to the top.
  const batches = [
    { id: 'seed-b1', file: 'progress-notes-week-of-04-14.pdf', actor: 'Dr. Sarah Connor',
      approved: 8, rejected: 0, encounters: 8, source: 'manual', daysAgo: 0.2,
      rejectedList: [] },
    { id: 'seed-b2', file: 'sftp-overnight-2026-04-12.pdf', actor: 'SFTP',
      approved: 12, rejected: 3, encounters: 15, source: 'sftp', daysAgo: 1.4,
      rejectedList: [
        { patientName: 'Patricia Moore', dos: '04/10/2026' },
        { patientName: 'Robert Kim', dos: '04/09/2026' },
        { patientName: 'James Walker', dos: '04/09/2026' },
      ]},
    { id: 'seed-b3', file: 'annual-wellness-bulk.pdf', actor: 'You',
      approved: 5, rejected: 1, encounters: 6, source: 'manual', daysAgo: 3.0,
      rejectedList: [{ patientName: 'Jane Doe', dos: '04/08/2026' }] },
    { id: 'seed-b4', file: 'discharge-summaries-april.pdf', actor: 'Dr. Helen Yu',
      approved: 4, rejected: 0, encounters: 4, source: 'manual', daysAgo: 5.5,
      rejectedList: [] },
    { id: 'seed-b5', file: 'multi-patient-chart-batch.pdf', actor: 'M. Singh',
      approved: 0, rejected: 0, encounters: 0, source: 'sftp', daysAgo: 7.0,
      rejectedList: [],
      // Failed extraction: surfaces as Processing/Failed status in the tab.
      failed: true },
  ];
  const rows = [];
  batches.forEach(b => {
    const baseTs = new Date(now - b.daysAgo * day);
    const iso = (offsetMin) => new Date(baseTs.getTime() + offsetMin * 60_000).toISOString();
    const scope = { batchId: b.id, fileId: b.file, source: b.source };
    rows.push({
      id: `${b.id}-c`, ts: iso(0), event_name: 'batch.created',
      batch_id: b.id, category: 'intake', severity: 'info',
      actor_name: b.actor,
      headline: `Batch ${b.id} created, 1 file queued.`,
      scope,
      payload: { batchId: b.id, fileCount: 1, fileName: b.file, actor: b.actor },
    });
    rows.push({
      id: `${b.id}-u`, ts: iso(1), event_name: 'file.uploaded',
      batch_id: b.id, category: 'intake', severity: 'info',
      actor_name: b.actor,
      headline: `${b.actor} uploaded ${b.file}.`,
      scope,
      payload: { actor: b.actor, fileName: b.file, pageCount: Math.max(1, Math.ceil(b.encounters / 2)) },
    });
    if (b.failed) {
      rows.push({
        id: `${b.id}-fail`, ts: iso(2), event_name: 'ocr.failed',
        batch_id: b.id, category: 'ocr', severity: 'error',
        actor_name: 'System',
        headline: `OCR failed on ${b.file}.`,
        scope,
        payload: { fileName: b.file, reason: 'Could not read PDF: likely corrupt or password-protected.' },
      });
    } else {
      rows.push({
        id: `${b.id}-oc`, ts: iso(2), event_name: 'ocr.completed',
        batch_id: b.id, category: 'ocr', severity: 'success',
        actor_name: 'System',
        headline: `OCR completed on ${b.file}, ${b.encounters} encounters extracted.`,
        scope,
        payload: {
          fileName: b.file,
          encounterCount: b.encounters,
          pageCount: Math.max(1, Math.ceil(b.encounters / 2)),
        },
      });
      rows.push({
        id: `${b.id}-pc`, ts: iso(3), event_name: 'batch.processing_completed',
        batch_id: b.id, category: 'intake', severity: 'success',
        actor_name: b.actor,
        headline: `Batch ${b.id} complete, ${b.approved} approved, ${b.rejected} rejected.`,
        scope,
        payload: {
          batchId: b.id,
          fileName: b.file,
          approvedCount: b.approved,
          rejectedCount: b.rejected,
          pendingCount: 0,
          acceptedList: [],
          rejectedList: b.rejectedList,
          actor: b.actor,
        },
      });
    }
  });
  // Newest-first.
  return rows.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
}
