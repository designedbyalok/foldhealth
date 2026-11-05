// SNP shared-list worklist rows. Columns mirror the SNP worklist design:
// Program Sub Status · Care Plan Status · Next Action Due · Outreach ·
// Assignee · Trigger Date · Last Admission · Trigger · Risk IQ · Tags · Tasks.
//
// outreach: null renders the muted "-" phone cell. When present:
//   kind   'call' | 'letter'  (icon)
//   status 'Failed' (red label) + date
//   dots   attempt indicators, each 'red' | 'blue' | 'grey'
// tags: [{ label, tone }] where tone ∈ 'blue' | 'green' | 'grey' | 'amber';
//   moreCount renders the "+N More" overflow chip.

export const SNP_WORKLIST_MEMBERS = [
  {
    id: 'snpw-001', initials: 'AB', name: 'Annette Brave', gender: 'F', age: '69y 1m', memberId: '11089', language: 'en',
    programSubStatus: '2nd Cont. – Fail', carePlanStatus: 'Signed', nextActionDue: '07/07/2025',
    outreach: null, assigneeName: 'Daniel Arsulo', assigneeInitials: 'DA', assigneeRole: 'Care Manager',
    triggerDate: '06/23/2025', lastAdmission: null, trigger: 'Reassessment', riskIq: 'Undetermined',
    // patientId stays null: no mock patient record has Fold ID 11089. It
    // previously pointed at 'p17', which is Carlos Hernandez (the old payer ids
    // differed by transposed digits), so Open navigated to the wrong chart.
    tags: [{ label: 'A1C/KED Kit', tone: 'blue' }], tagsMore: 0, taskCount: 0, patientId: null,
  },
  {
    id: 'snpw-002', initials: 'WD', name: 'William Davis', gender: 'M', age: '77y 11m', memberId: '10029', language: 'en',
    programSubStatus: 'Attempted', carePlanStatus: 'Signed', nextActionDue: '11/11/2025',
    outreach: { kind: 'letter', status: 'Failed', date: '09/03/2025', dots: ['red', 'grey', 'grey'] },
    assigneeName: 'Dr. Shravank Montgomery', assigneeInitials: 'SM', assigneeRole: 'Physician',
    triggerDate: '09/02/2025', lastAdmission: null, trigger: 'New Member', riskIq: 'Undetermined',
    tags: [], tagsMore: 0, taskCount: 2, patientId: null,
  },
  {
    id: 'snpw-003', initials: 'JR', name: 'James Rivera', gender: 'M', age: '72y 0m', memberId: '11039', language: 'en',
    programSubStatus: 'Attempted', carePlanStatus: 'In Review', nextActionDue: '11/11/2025',
    outreach: { kind: 'letter', status: 'Failed', date: '09/03/2025', dots: ['red', 'grey', 'grey'] },
    assigneeName: 'Dr. Shravank Montgomery', assigneeInitials: 'SM', assigneeRole: 'Physician',
    triggerDate: '09/02/2025', lastAdmission: null, trigger: 'New Member', riskIq: 'Undetermined',
    tags: [], tagsMore: 0, taskCount: 3, patientId: null,
  },
  {
    id: 'snpw-004', initials: 'RH', name: 'Ralph Halvorson', gender: 'M', age: '52y 5m', memberId: '10003', language: 'en',
    programSubStatus: 'Attempted', carePlanStatus: 'No Care Plan', nextActionDue: '11/11/2025',
    outreach: { kind: 'letter', status: 'Failed', date: '09/03/2025', dots: ['red', 'grey', 'grey'] },
    assigneeName: 'Dr. Shravank Montgomery', assigneeInitials: 'SM', assigneeRole: 'Physician',
    triggerDate: '09/02/2025', lastAdmission: null, trigger: 'New Member', riskIq: 'Undetermined',
    tags: [], tagsMore: 0, taskCount: 0, patientId: null,
  },
  {
    id: 'snpw-005', initials: 'EG', name: 'Elena Garcia', gender: 'F', age: '74y 1m', memberId: '11053', language: 'es',
    programSubStatus: 'Attempted', carePlanStatus: 'No Care Plan', nextActionDue: '11/11/2025',
    outreach: { kind: 'letter', status: 'Failed', date: '09/03/2025', dots: ['red', 'grey', 'grey'] },
    assigneeName: 'Dr. Shravank Montgomery', assigneeInitials: 'SM', assigneeRole: 'Physician',
    triggerDate: '09/02/2025', lastAdmission: null, trigger: 'New Member', riskIq: 'Undetermined',
    tags: [{ label: 'ENG*', tone: 'green' }], tagsMore: 0, taskCount: 2, patientId: null,
  },
  {
    id: 'snpw-006', initials: 'AB', name: 'Annette Brave', gender: 'O', age: '48y 4m', memberId: '11089', language: 'yue',
    programSubStatus: 'Attempted', carePlanStatus: 'Signed', nextActionDue: '08/25/2025',
    outreach: null, assigneeName: 'Dr. Shravank Montgomery', assigneeInitials: 'SM', assigneeRole: 'Physician',
    triggerDate: '08/11/2025', lastAdmission: null, trigger: 'New Member', riskIq: 'Undetermined',
    tags: [{ label: '2_April_12', tone: 'grey' }], tagsMore: 0, taskCount: 0, patientId: null,
  },
  {
    id: 'snpw-007', initials: 'HJ', name: 'Helen Jackson', gender: 'F', age: '70y 6m', memberId: '11045', language: 'en',
    programSubStatus: 'Attempted', carePlanStatus: 'Signed', nextActionDue: '07/07/2025',
    outreach: null, assigneeName: null, assigneeInitials: null,
    triggerDate: '06/23/2025', lastAdmission: null, trigger: 'Reassessment', riskIq: 'Undetermined',
    tags: [{ label: 'NewTag', tone: 'grey' }], tagsMore: 0, taskCount: 0, patientId: null,
  },
  {
    id: 'snpw-008', initials: 'LB', name: 'Lisa Brown', gender: 'F', age: '63y 7m', memberId: '11145', language: 'en',
    programSubStatus: 'Attempted', carePlanStatus: 'Draft', nextActionDue: '06/30/2025',
    outreach: null, assigneeName: 'PoojaNurse CFC Hills', assigneeInitials: 'PN', assigneeRole: 'SNP Nurse',
    triggerDate: '06/16/2025', lastAdmission: null, trigger: 'Reassessment', riskIq: 'Undetermined',
    tags: [{ label: 'Inactive Membership', tone: 'grey' }], tagsMore: 7, taskCount: 3, patientId: null,
  },
  {
    id: 'snpw-009', initials: 'DW', name: 'Diana Welch', gender: 'F', age: '55y 2m', memberId: '10985', language: 'en',
    programSubStatus: 'Attempted', carePlanStatus: 'Draft', nextActionDue: '07/07/2025',
    outreach: { kind: 'call', status: 'Failed', date: '06/30/2026', dots: ['red', 'grey', 'grey'] },
    assigneeName: 'shravank 7hills', assigneeInitials: 'S7', assigneeRole: 'SNP Nurse',
    triggerDate: '06/23/2025', lastAdmission: null, trigger: 'Reassessment', riskIq: 'Undetermined',
    tags: [], tagsMore: 0, taskCount: 0, patientId: null,
  },
  {
    id: 'snpw-010', initials: 'ML', name: 'Maria Lopez', gender: 'F', age: '57y 6m', memberId: '11119', language: 'es',
    programSubStatus: 'Attempted', carePlanStatus: 'Draft', nextActionDue: '07/07/2025',
    outreach: { kind: 'call', status: 'Failed', date: '08/01/2025', dots: ['red', 'grey', 'grey'] },
    assigneeName: null, assigneeInitials: null,
    triggerDate: '06/23/2025', lastAdmission: null, trigger: 'Reassessment', riskIq: 'Undetermined',
    tags: [], tagsMore: 0, taskCount: 0, patientId: null,
  },
  {
    id: 'snpw-011', initials: 'CM', name: 'Carla Mendez', gender: 'F', age: '61y 2m', memberId: '18401', language: 'es',
    programSubStatus: 'Attempted', carePlanStatus: 'Draft', nextActionDue: '07/07/2025',
    outreach: { kind: 'call', status: 'Failed', date: '10/30/2025', dots: ['red', 'red', 'red'] },
    assigneeName: 'Chemy Maa', assigneeInitials: 'CM', assigneeRole: 'Care Coordinator',
    triggerDate: '06/23/2025', lastAdmission: null, trigger: 'Reassessment', riskIq: 'Undetermined',
    tags: [{ label: '2_Mod-High', tone: 'amber' }], tagsMore: 0, taskCount: 0, patientId: null,
  },
  {
    id: 'snpw-012', initials: 'DA', name: 'Derek Alton', gender: 'M', age: '66y 9m', memberId: '18402', language: 'en',
    programSubStatus: 'Attempted', carePlanStatus: 'Signed', nextActionDue: '08/22/2025',
    outreach: { kind: 'call', status: 'Failed', date: '08/19/2025', dots: ['red', 'red', 'blue'] },
    assigneeName: 'Daniel Arsulo', assigneeInitials: 'DA', assigneeRole: 'Care Manager',
    triggerDate: '07/08/2025', lastAdmission: null, trigger: 'Reassessment', riskIq: 'Undetermined',
    tags: [], tagsMore: 0, taskCount: 0, patientId: null,
  },
  {
    id: 'snpw-013', initials: 'PT', name: 'Priya Tandon', gender: 'F', age: '58y 7m', memberId: '18403', language: 'hi',
    programSubStatus: 'Attempted', carePlanStatus: 'Draft', nextActionDue: '07/07/2025',
    outreach: null, assigneeName: 'Dr. Shravank Montgomery', assigneeInitials: 'SM', assigneeRole: 'Physician',
    triggerDate: '06/23/2025', lastAdmission: null, trigger: 'Reassessment', riskIq: 'Undetermined',
    tags: [], tagsMore: 0, taskCount: 0, patientId: null,
  },
  {
    id: 'snpw-014', initials: 'MG', name: 'Michelle Grant', gender: 'F', age: '72y 2m', memberId: '18404', language: 'en',
    programSubStatus: 'Attempted', carePlanStatus: 'No Care Plan', nextActionDue: '07/07/2025',
    outreach: null, assigneeName: 'Michelle Ling', assigneeInitials: 'ML', assigneeRole: 'Care Manager',
    triggerDate: '06/23/2025', lastAdmission: null, trigger: 'Reassessment', riskIq: 'Undetermined',
    tags: [], tagsMore: 0, taskCount: 0, patientId: null,
  },
  {
    id: 'snpw-015', initials: 'RS', name: 'Robert Singh', gender: 'M', age: '75y 2m', memberId: '18405', language: 'en',
    programSubStatus: 'Attempted', carePlanStatus: 'No Care Plan', nextActionDue: '07/07/2025',
    outreach: null, assigneeName: 'Dr. Shravank Montgomery', assigneeInitials: 'SM', assigneeRole: 'Physician',
    triggerDate: null, lastAdmission: null, trigger: 'TOC', riskIq: 'Undetermined',
    tags: [], tagsMore: 0, taskCount: 0, patientId: null,
  },
];
