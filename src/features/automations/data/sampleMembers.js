/* Sample members for Settings > Automations when the account has no patient
   records loaded (an empty dev database): the seeded run history and the Run
   Automation drawer use them so the screens have someone to show. Shaped like
   all_patients rows in the store. A few have a missing or malformed address
   so failure handling has something to show. */

const FIRST = ['Maria', 'James', 'Aisha', 'Robert', 'Linda', 'Daniel', 'Priya', 'Michael', 'Grace', 'Carlos', 'Emily', 'Kevin',
  'Sofia', 'Thomas', 'Hannah', 'David', 'Mei', 'Anthony', 'Olivia', 'Samuel', 'Fatima', 'Brian', 'Chloe', 'Luis'];
const LAST = ['Alvarez', 'Bennett', 'Chen', 'Dawson', 'Edwards', 'Fischer', 'Garcia', 'Hughes', 'Iyer', 'Johnson', 'Kim', 'Lopez',
  'Morales', 'Nguyen', 'Okafor', 'Patel', 'Quinn', 'Reyes', 'Sato', 'Turner'];
const TAG_SETS = [['High Risk', 'Hypertensive'], ['High Risk', 'Hypertensive', 'Diabetic'], ['Diabetic'], ['High Risk'], [], ['Hypertensive'], ['CHF', 'High Risk', 'Hypertensive']];
const PROGRAMS = ['CCM', 'RPM', 'TCM', null, 'APCM', null];
const CITIES = [['San Francisco', 'CA'], ['Oakland', 'CA'], ['San Jose', 'CA'], ['Sacramento', 'CA'], ['Fresno', 'CA']];

export const SAMPLE_MEMBERS = Array.from({ length: 96 }, (_, i) => {
  const first = FIRST[i % FIRST.length];
  const last = LAST[(i * 7) % LAST.length];
  const [city, state] = CITIES[i % CITIES.length];
  return {
    id: `sample-${String(i + 1).padStart(3, '0')}`,
    name: `${first} ${last}`,
    memberId: `FH${String(100200 + i * 37)}`,
    gender: i % 2 ? 'Female' : 'Male',
    age: 28 + ((i * 13) % 55),
    // Every 23rd has no usable email, every 29th no phone.
    email: i % 23 === 5 ? `${first.toLowerCase()}.${last.toLowerCase()}@` : `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
    phone: i % 29 === 7 ? '' : `(415) 555-${String(1000 + i * 17).slice(-4)}`,
    tags: TAG_SETS[i % TAG_SETS.length],
    city,
    state,
    language: i % 9 === 3 ? 'es' : 'en',
    coverageType: i % 10 === 9 ? null : ['Employee', 'Spouse', 'Child'][i % 3],
    ccmConsent: i % 4 !== 0,
    activeCareProgram: PROGRAMS[i % PROGRAMS.length],
    lastVisit: new Date(Date.UTC(2026, 6 + (i % 4), 1 + (i % 27))).toISOString().slice(0, 10),
    patientAppActive: i % 3 === 0,
    groupNumber: ['Acme Logistics', 'Bayview Schools', 'Northgate Health Plan'][i % 3],
  };
});
