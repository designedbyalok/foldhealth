import { describe, expect, it } from 'vitest';
import {
  foldProtocolJsonTemplate,
  formatCadence,
  formatThreshold,
  isFoldProtocolJson,
  isoDateOrNull,
  normalizeProtocol,
  protocolCounts,
  protocolGuidanceText,
} from './protocolSchema';

describe('normalizeProtocol', () => {
  it('keeps usable items, drops incomplete ones and assigns ids', () => {
    const { protocol } = normalizeProtocol({
      thresholds: [
        { measure: 'Systolic BP', comparator: '>=', value: 140, unit: 'mmHg', source: 'Stage 2: systolic 140 or higher' },
        { measure: 'Systolic BP', comparator: 'between', value: 130, value2: 139, unit: 'mmHg', source: '130-139' },
        { measure: 'Systolic BP', comparator: 'between', value: 130, source: 'no upper bound' },
        { measure: '', comparator: '>=', value: 1, source: 'x' },
      ],
      decisionRules: [{ when: 'K > 5.5', then: 'Hold the agent', source: 'x' }, { when: 'only half' }],
    });
    expect(protocol.thresholds.map(t => t.id)).toEqual(['t1', 't2']);
    expect(protocol.thresholds[1]).toMatchObject({ comparator: 'between', value: 130, value2: 139 });
    expect(protocol.decisionRules).toHaveLength(1);
  });

  it('coerces enums and numbers', () => {
    const { protocol } = normalizeProtocol({
      cadence: [{ activity: 'Check-in', kind: 'weird', times: '2', every: '1', unit: 'fortnight', source: 'x' }],
      titration: [{ medication: 'Lisinopril', step: 0, action: 'double', source: 'x' }],
    });
    expect(protocol.cadence[0]).toMatchObject({ kind: 'other', times: 2, every: 1, unit: 'week' });
    expect(protocol.titration[0]).toMatchObject({ step: 1, action: 'start' });
  });

  it('keeps program codes to the allowed list and dates to real calendar days', () => {
    const { metadata, warnings } = normalizeProtocol({
      metadata: { title: 'HTN', programCodes: ['DM', 'XYZ'], effectiveDate: '2026-01-15', reviewDate: '2025-01-01' },
    }, { programCodes: ['DM', 'SNP'] });
    expect(metadata.programCodes).toEqual(['DM']);
    expect(metadata.effectiveDate).toBe('2026-01-15');
    expect(metadata.reviewDate).toBeNull();
    expect(warnings[0]).toMatch(/before the effective date/);
  });

  it('round-trips the Fold JSON template', () => {
    const template = foldProtocolJsonTemplate();
    expect(isFoldProtocolJson(template)).toBe(true);
    const { protocol } = normalizeProtocol(template);
    expect(protocolCounts(protocol).total).toBe(6);
  });
});

describe('isoDateOrNull', () => {
  it('accepts only real YYYY-MM-DD dates', () => {
    expect(isoDateOrNull('2026-02-28')).toBe('2026-02-28');
    expect(isoDateOrNull('2026-02-30')).toBeNull();
    expect(isoDateOrNull('01/15/2026')).toBeNull();
  });
});

describe('formatting', () => {
  it('formats thresholds', () => {
    expect(formatThreshold({ measure: 'Systolic BP', comparator: '>=', value: 140, unit: 'mmHg' })).toBe('Systolic BP ≥ 140 mmHg');
    expect(formatThreshold({ measure: 'Systolic BP', comparator: 'between', value: 130, value2: 139, unit: 'mmHg' })).toBe('Systolic BP 130–139 mmHg');
  });

  it('formats cadence, including times per period', () => {
    expect(formatCadence({ times: 1, every: 2, unit: 'week' })).toBe('Every 2 weeks');
    expect(formatCadence({ times: 1, every: 1, unit: 'month' })).toBe('Every month');
    expect(formatCadence({ times: 2, every: 1, unit: 'day' })).toBe('Twice daily');
    expect(formatCadence({ times: 3, every: 2, unit: 'week' })).toBe('3 times every 2 weeks');
  });
});

describe('protocolGuidanceText', () => {
  it('lists scope, thresholds, rules, cadence and titration as plain lines', () => {
    const { protocol } = normalizeProtocol(foldProtocolJsonTemplate());
    const text = protocolGuidanceText(protocol);
    expect(text).toMatch(/^Summary: /);
    expect(text).toContain('Conditions: Essential hypertension (I10)');
    expect(text).toContain('- Systolic BP ≥ 180 mmHg | Hypertensive urgency | Same-day provider review');
    expect(text).toContain('- Twice daily: Home BP reading | 7 days before each provider visit');
    expect(text).toContain('- Step 1 start Lisinopril | 10 mg daily | BP above goal');
  });

  it('stops at the character limit on a whole line', () => {
    const { protocol } = normalizeProtocol(foldProtocolJsonTemplate());
    const text = protocolGuidanceText(protocol, { max: 120 });
    expect(text.length).toBeLessThanOrEqual(120);
    expect(text.split('\n').every(l => !l.endsWith('…'))).toBe(true);
  });
});

describe('reviewer checks', () => {
  it('keeps a check on the item it concerns, and whole-document warnings in full', () => {
    const long = `Page 3 ${'gives two different cut-offs for the same stage and should be confirmed with the author '.repeat(2)}`.trim();
    const { protocol, warnings } = normalizeProtocol({
      metadata: { title: 'HTN', conditions: [], programCodes: [] },
      thresholds: [
        { measure: 'Systolic BP', comparator: '>', value: 140, source: 'over 140', page: 3, check: 'Page 1 says <140 is the goal; confirm 140 belongs to Stage 2.' },
        { measure: 'Systolic BP', comparator: '>=', value: 180, source: '180/120', page: 4, check: '  ' },
      ],
      warnings: [long],
    });
    expect(protocol.thresholds[0].check).toBe('Page 1 says <140 is the goal; confirm 140 belongs to Stage 2.');
    expect(protocol.thresholds[1].check).toBeNull();
    expect(warnings[0]).toBe(long);
  });
});
