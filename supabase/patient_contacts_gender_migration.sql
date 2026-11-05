-- Contacts' gender, for the Send To pickers' second line ("F • 47Y"),
-- matching the patient banner.
ALTER TABLE patient_contacts ADD COLUMN IF NOT EXISTS gender TEXT;
