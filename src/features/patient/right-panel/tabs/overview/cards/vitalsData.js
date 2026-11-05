import { OVERVIEW_SEED } from '../../../../data/overviewData';
import { TABLE_SECTIONS, VITALS, formatVital } from '../../../../left-panel/tabs/vitals-labs/vitalsConfig';

/**
 * The patient_overview row's vitals with the sample goals, diastolic history
 * and source icons filled in from OVERVIEW_SEED until the row carries its own.
 */
export function overviewVitals(overview, memberId) {
  const seeded = Object.fromEntries((OVERVIEW_SEED[memberId]?.vitals || []).map(v => [v.key, v]));
  return (overview?.vitals || []).map((v) => {
    const sample = seeded[v.key];
    return {
      ...v,
      goalFrom: v.goalFrom || sample?.goalFrom,
      goalTo: v.goalTo || sample?.goalTo,
      diastolicSeries: v.diastolicSeries || sample?.diastolicSeries,
      sourceIcon: v.sourceIcon || sample?.sourceIcon,
    };
  });
}

// Biomarker rows that are the same measure as an overview vital.
const SAME_AS = { hba1c: 'a1c', bg: 'glucose' };
const DATE_SOURCE = { vitals: 'solar:stethoscope-linear', biomarkers: 'solar:test-tube-linear', lab: 'solar:test-tube-linear', activity: 'solar:walking-linear' };

const pad = n => String(n).padStart(2, '0');
// '2025-03-09' or '3/9/25' → '03/09/2025'.
function displayDate(value) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(value || '');
  if (!us) return value || null;
  const year = us[3].length === 2 ? `20${us[3]}` : us[3];
  return `${pad(us[1])}/${pad(us[2])}/${year}`;
}

const num = v => Number(String(v).replace(/,/g, ''));

// A tile from readings oldest → newest: the latest value, its change from
// the one before, and the series. No goal: none is on file for these.
function readingsTile({ key, label, unit, readings, section }) {
  const series = readings.map(r => r.n).filter(Number.isFinite);
  const last = readings[readings.length - 1];
  const prev = readings[readings.length - 2];
  const delta = prev && Number.isFinite(last.n) && Number.isFinite(prev.n) ? last.n - prev.n : 0;
  const decimals = String(last.n).includes('.') ? 1 : 0;
  return {
    key,
    label,
    unit,
    value: last.text,
    change: delta ? Math.abs(delta).toLocaleString('en-US', { maximumFractionDigits: decimals }) : null,
    direction: delta < 0 ? 'down' : 'up',
    tone: last.flag ? 'warning' : 'success',
    measuredAt: displayDate(last.date),
    sourceIcon: DATE_SOURCE[section],
    series,
    diastolicSeries: readings.every(r => r.n2 != null) ? readings.map(r => r.n2) : undefined,
  };
}

/**
 * Everything the Vitals widget can show, in a stable order: the overview's
 * vitals, then recorded vitals (patient_vitals, or the Vitals tab's sample
 * history), then the Vitals tab's biomarkers, activity and labs.
 * `history` is vitalsHistory(rows): readings per vital key, newest first.
 */
export function vitalCatalog(overview, memberId, history = {}) {
  const tiles = overviewVitals(overview, memberId);
  const have = new Set(tiles.map(t => t.key));
  for (const v of VITALS) {
    const rows = history[v.key];
    if (have.has(v.key) || !rows?.length) continue;
    const readings = [...rows].reverse().map(r => ({
      // Height plots in inches; Blood Pressure carries its diastolic.
      n: v.key === 'ht' ? num(r.value) * 12 + num(r.value2 || 0) : num(r.value),
      n2: v.key === 'bp' ? num(r.value2) : null,
      text: formatVital(v.key, r.value, r.value2),
      date: r.recorded_on,
      flag: r.flag,
    }));
    tiles.push(readingsTile({ key: v.key, label: v.name, unit: v.key === 'ht' ? '' : v.unit, readings, section: 'vitals' }));
    have.add(v.key);
  }
  for (const section of TABLE_SECTIONS) {
    for (const row of section.rows) {
      if (have.has(row.id) || have.has(SAME_AS[row.id])) continue;
      const readings = [...row.values].reverse().map(r => ({ n: num(r.v), n2: null, text: r.v, date: r.date, flag: r.flag }));
      tiles.push(readingsTile({ key: row.id, label: row.name, unit: row.unit, readings, section: section.id }));
      have.add(row.id);
    }
  }
  return tiles;
}

/** The tiles to show: the saved keys in their order, else the overview's own vitals. */
export function shownVitals(catalog, overview, savedKeys) {
  const byKey = new Map(catalog.map(t => [t.key, t]));
  const keys = savedKeys ?? (overview?.vitals || []).map(v => v.key);
  return keys.map(k => byKey.get(k)).filter(Boolean);
}
