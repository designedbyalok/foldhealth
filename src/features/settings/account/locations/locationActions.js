import { supabase } from '../../../../lib/supabase';

// Save and delete a practice location, shared by Settings > Account >
// Locations on desktop and the phone. Both are optimistic: the store changes
// first and a failed write re-fetches so the list stays honest.

export async function saveLocation(location, { upsertLocation, fetchLocations, showToast }) {
  upsertLocation(location);
  const row = {
    id:              location.id,
    name:            location.name,
    ehr_instance:    location.ehrInstance,
    address_line_1: location.addressLine1,
    address_line_2: location.addressLine2,
    city:            location.city,
    state:           location.state,
    zip_code:        location.zipCode,
    timezone:        location.timezone,
    google_map_link: location.googleMapLink,
    default_phone:   location.defaultPhone,
    business_hours:  location.businessHours,
    updated_at:      new Date().toISOString(),
  };
  const { error } = await supabase.from('practice_locations').upsert(row, { onConflict: 'id' });
  if (error) {
    showToast?.(`Save failed: ${error.message}`);
    fetchLocations();
    return false;
  }
  showToast?.(`${location.name} saved`);
  return true;
}

// Soft delete: the row keeps its history with a deleted_at stamp.
export async function deleteLocation(target, { removeLocation, fetchLocations, showToast }) {
  removeLocation(target.id);
  const { error } = await supabase
    .from('practice_locations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', target.id);
  if (error) {
    showToast?.(`Delete failed: ${error.message}`);
    fetchLocations();
    return false;
  }
  showToast?.(`${target.name} deleted`);
  return true;
}
