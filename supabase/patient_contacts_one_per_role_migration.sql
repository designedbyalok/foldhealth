-- A patient has at most one contact per role (one Care Giver, one Emergency
-- Contact, one Decision Maker, one Alternate Decision Maker). One person can
-- still hold several roles: they're one row per role.
CREATE UNIQUE INDEX IF NOT EXISTS patient_contacts_one_per_role
  ON patient_contacts (patient_id, type);
