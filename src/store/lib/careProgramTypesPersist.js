import { supabase } from '../../lib/supabase';
import { programTypeToRow, rowToProgramType } from '../../features/settings/care-program-config/careProgramConfigModel';

// Supabase I/O for supabase/care_program_types_migration.sql.
const MISSING_RE = /care_program_types|does not exist|schema cache/i;

/** `{ types, missing }`: missing is true until the migration has run. */
export async function fetchProgramTypeRows() {
  const { data, error } = await supabase
    .from('care_program_types')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return { types: [], missing: MISSING_RE.test(error.message || ''), error };
  return { types: (data || []).map(rowToProgramType), missing: false };
}

export async function persistProgramType(type) {
  const save = row => supabase.from('care_program_types').upsert(row, { onConflict: 'id' }).select('*').single();
  let { data, error } = await save(programTypeToRow(type));
  // Before care_plan_cadence_migration.sql has run there is no cadence column:
  // save the rest so the other tabs keep working.
  if (error && /cadence/i.test(error.message || '')) {
    const { cadence: _cadence, ...row } = programTypeToRow(type);
    ({ data, error } = await save(row));
  }
  return { type: data ? rowToProgramType(data) : null, error };
}

export async function persistProgramTypeDelete(id) {
  const { error } = await supabase.from('care_program_types').delete().eq('id', id);
  return { error };
}
