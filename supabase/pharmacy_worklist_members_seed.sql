-- Pharmacy worklist seed: the 10 Med Adherence members from
-- src/features/pharmacy-worklist/data/mock.js, mapped exactly like
-- pharmacyWorklistToRow in scripts/seed.js. Loads this one table, so the
-- rollout never needs the full `bun run seed`.
--
-- Rows follow the source-table identity rule: id = member_id = patient_id
-- (Fold IDs 19401-19410, a reserved block like HEDIS's 19301-19305).
-- Insert-only per person, same as withoutExistingPeople in seed.js: a member
-- already in the table (by name) is skipped, so worked rows are never reset.
-- Regenerate from the mock if it changes.

INSERT INTO public.pharmacy_worklist_members (id, member_id, patient_id, name, initials, gender, age, dob, language, health_plan, ipa, book_of_business, status, status_manual, assignee_id, assignee_name, assignee_initials, lead_note, follow_up_due, barrier, days_in_queue, prescriber, pharmacy, phones, call_history, intervention_log, activity_log, measures)
SELECT id, member_id, patient_id, name, initials, gender, age, dob, language, health_plan, ipa, book_of_business, status, status_manual, assignee_id, assignee_name, assignee_initials, lead_note, follow_up_due, barrier, days_in_queue, prescriber, pharmacy, phones, call_history, intervention_log, activity_log, measures
FROM   jsonb_populate_recordset(NULL::public.pharmacy_worklist_members, '[
 {
  "id": "19401",
  "member_id": "19401",
  "patient_id": "19401",
  "name": "Maria Gonzalez",
  "initials": "MG",
  "gender": "F",
  "age": "71y 4m",
  "dob": "06/02/1955",
  "language": "es",
  "health_plan": "Humana Gold Plus",
  "ipa": "Astrana IPA",
  "book_of_business": "Astrana",
  "status": "In Progress",
  "status_manual": false,
  "assignee_id": null,
  "assignee_name": null,
  "assignee_initials": null,
  "lead_note": "Call pharmacy first; member asked for Spanish-speaking staff.",
  "follow_up_due": "10/15/2026",
  "barrier": "Cost Issue",
  "days_in_queue": 9,
  "prescriber": {
   "name": "Dr. Alan Choi",
   "phone": "(626) 555-0142",
   "fax": "(626) 555-0143",
   "address1": "1798 N Garey Ave",
   "city": "Pomona",
   "state": "CA",
   "zip": "91767"
  },
  "pharmacy": {
   "name": "CVS Pharmacy #9921",
   "phone": "(626) 555-0190",
   "address1": "255 W Foothill Blvd",
   "city": "Claremont",
   "state": "CA",
   "zip": "91711"
  },
  "phones": [
   {
    "number": "(626) 555-0111",
    "label": "Mobile",
    "doNotUse": false
   },
   {
    "number": "(626) 555-0112",
    "label": "Home",
    "doNotUse": true
   }
  ],
  "call_history": [
   {
    "date": "10/09/2026",
    "contact": "Pharmacy",
    "outcome": "Confirmed medication pickup date",
    "result": "success",
    "by": "Priya Natarajan",
    "note": "Metformin picked up today.",
    "measures": [
     "MAD"
    ]
   },
   {
    "date": "10/08/2026",
    "contact": "Pharmacy",
    "outcome": "Pending: Pick up",
    "result": "failed",
    "by": "Priya Natarajan",
    "note": "Ready since 10/01.",
    "measures": [
     "MAD"
    ]
   }
  ],
  "intervention_log": [],
  "activity_log": [
   {
    "at": "2026-10-09T04:30:00.000Z",
    "actor": "Priya Natarajan",
    "t": "outreach",
    "title": "Outreach · Pharmacy (MAD)",
    "outcome": "Confirmed medication pickup date",
    "outcomeColor": "var(--status-success)",
    "note": "Metformin picked up today."
   },
   {
    "at": "2026-10-08T05:30:00.000Z",
    "actor": "Priya Natarajan",
    "t": "outreach",
    "title": "Outreach · Pharmacy (MAD)",
    "outcome": "Pending: Pick up",
    "outcomeColor": "var(--status-error)",
    "note": "Ready since 10/01."
   }
  ],
  "measures": [
   {
    "code": "MAD",
    "pdc": 78,
    "calcPdc": 76,
    "failDate": "10/24/2026",
    "daysLeft": 11,
    "priorYearNonCompliant": true,
    "excluded": false,
    "projectedStatus": "Unlikely by year end",
    "drugInteraction": false,
    "pickupConfirmed": "10/09/2026",
    "claim": {
     "status": "Paid",
     "date": "07/06/2026",
     "rxNumber": "RX-4471902"
    },
    "nextFillDue": "10/04/2026",
    "medications": [
     {
      "status": "Active",
      "unit": "MG",
      "doseForm": "Tablet",
      "route": "Oral",
      "nonAdherenceReason": "Cost Issue",
      "notesToMd": "Member reports $47 copay; generic alternatives?",
      "internalNotes": "",
      "id": "19401-mad-1",
      "name": "Metformin ER",
      "generic": "metformin",
      "strength": "500",
      "sig": "Take 1 tablet by mouth daily with evening meal",
      "condition": "Type 2 diabetes",
      "mpr": 76,
      "pdc": 78,
      "qty": 90,
      "daysSupply": 90,
      "lastFill": "07/06/2026",
      "prescriber": {
       "name": "Dr. Alan Choi",
       "phone": "(626) 555-0142",
       "fax": "(626) 555-0143",
       "address1": "1798 N Garey Ave",
       "city": "Pomona",
       "state": "CA",
       "zip": "91767"
      },
      "pharmacy": {
       "name": "CVS Pharmacy #9921",
       "phone": "(626) 555-0190",
       "address1": "255 W Foothill Blvd",
       "city": "Claremont",
       "state": "CA",
       "zip": "91711"
      },
      "nextFill": "10/04/2026",
      "refills": [
       {
        "date": "07/06/2026",
        "qty": 90,
        "daysSupply": 90,
        "pharmacy": "CVS Pharmacy #9921",
        "prescriber": "Dr. Alan Choi",
        "prescriberAddress": "1798 N Garey Ave, Pomona, CA, 91767"
       },
       {
        "date": "04/01/2026",
        "qty": 90,
        "daysSupply": 90,
        "pharmacy": "CVS Pharmacy #9921",
        "prescriber": "Dr. Alan Choi",
        "prescriberAddress": "1798 N Garey Ave, Pomona, CA, 91767"
       },
       {
        "date": "12/20/2025",
        "qty": 90,
        "daysSupply": 90,
        "pharmacy": "CVS Pharmacy #9921",
        "prescriber": "Dr. Alan Choi",
        "prescriberAddress": "1798 N Garey Ave, Pomona, CA, 91767"
       },
       {
        "date": "09/12/2025",
        "qty": 90,
        "daysSupply": 90,
        "pharmacy": "CVS Pharmacy #9921",
        "prescriber": "Dr. Alan Choi",
        "prescriberAddress": "1798 N Garey Ave, Pomona, CA, 91767"
       }
      ]
     }
    ]
   },
   {
    "code": "MAH",
    "pdc": 88,
    "calcPdc": 87,
    "failDate": "11/30/2026",
    "daysLeft": 48,
    "priorYearNonCompliant": false,
    "excluded": false,
    "projectedStatus": null,
    "drugInteraction": false,
    "pickupConfirmed": null,
    "claim": {
     "status": "Paid",
     "date": "07/20/2026",
     "rxNumber": "RX-4471955"
    },
    "nextFillDue": "10/18/2026",
    "medications": [
     {
      "status": "Active",
      "unit": "MG",
      "doseForm": "Tablet",
      "route": "Oral",
      "nonAdherenceReason": null,
      "notesToMd": "",
      "internalNotes": "",
      "id": "19401-mah-1",
      "name": "Lisinopril",
      "generic": "lisinopril",
      "strength": "10",
      "sig": "Take 1 tablet by mouth once daily",
      "condition": "Hypertension",
      "mpr": 87,
      "pdc": 88,
      "qty": 90,
      "daysSupply": 90,
      "lastFill": "07/20/2026",
      "prescriber": {
       "name": "Dr. Alan Choi",
       "phone": "(626) 555-0142",
       "fax": "(626) 555-0143",
       "address1": "1798 N Garey Ave",
       "city": "Pomona",
       "state": "CA",
       "zip": "91767"
      },
      "pharmacy": {
       "name": "CVS Pharmacy #9921",
       "phone": "(626) 555-0190",
       "address1": "255 W Foothill Blvd",
       "city": "Claremont",
       "state": "CA",
       "zip": "91711"
      },
      "nextFill": "10/18/2026",
      "refills": [
       {
        "date": "07/20/2026",
        "qty": 90,
        "daysSupply": 90,
        "pharmacy": "CVS Pharmacy #9921",
        "prescriber": "Dr. Alan Choi",
        "prescriberAddress": "1798 N Garey Ave, Pomona, CA, 91767"
       },
       {
        "date": "04/17/2026",
        "qty": 90,
        "daysSupply": 90,
        "pharmacy": "CVS Pharmacy #9921",
        "prescriber": "Dr. Alan Choi",
        "prescriberAddress": "1798 N Garey Ave, Pomona, CA, 91767"
       },
       {
        "date": "01/11/2026",
        "qty": 90,
        "daysSupply": 90,
        "pharmacy": "CVS Pharmacy #9921",
        "prescriber": "Dr. Alan Choi",
        "prescriberAddress": "1798 N Garey Ave, Pomona, CA, 91767"
       }
      ]
     }
    ]
   }
  ]
 },
 {
  "id": "19402",
  "member_id": "19402",
  "patient_id": "19402",
  "name": "Robert Tanaka",
  "initials": "RT",
  "gender": "M",
  "age": "68y 9m",
  "dob": "01/11/1958",
  "language": "en",
  "health_plan": "SCAN Classic",
  "ipa": "Astrana IPA",
  "book_of_business": "Astrana",
  "status": "In Progress",
  "status_manual": false,
  "assignee_id": null,
  "assignee_name": "Priya Natarajan",
  "assignee_initials": "PN",
  "lead_note": "Pickup confirmed 3 weeks ago but plan still shows the gap, check with plan.",
  "follow_up_due": "10/14/2026",
  "barrier": "Forgetfulness",
  "days_in_queue": 15,
  "prescriber": {
   "name": "Dr. Helen Park",
   "phone": "(213) 555-0177",
   "fax": "(213) 555-0178",
   "address1": "1866 N Orange Grove Ave Suite 202",
   "city": "Pomona",
   "state": "CA",
   "zip": "91767"
  },
  "pharmacy": {
   "name": "Walgreens #4410",
   "phone": "(213) 555-0120",
   "address1": "1501 W Holt Ave",
   "city": "Pomona",
   "state": "CA",
   "zip": "91768"
  },
  "phones": [
   {
    "number": "(213) 555-0133",
    "label": "Mobile",
    "doNotUse": false
   }
  ],
  "call_history": [
   {
    "date": "10/10/2026",
    "contact": "Member",
    "outcome": "Discussed daily medication routine and timing",
    "result": "success",
    "by": "Priya Natarajan",
    "note": "Set up pill organizer reminder.",
    "measures": [
     "MAC"
    ]
   },
   {
    "date": "09/22/2026",
    "contact": "Pharmacy",
    "outcome": "Confirmed medication pickup date",
    "result": "success",
    "by": "Priya Natarajan",
    "note": "",
    "measures": [
     "MAC"
    ]
   },
   {
    "date": "09/18/2026",
    "contact": "Pharmacy",
    "outcome": "Pending: Pick up",
    "result": "failed",
    "by": "Priya Natarajan",
    "note": "",
    "measures": [
     "MAC"
    ]
   }
  ],
  "intervention_log": [],
  "activity_log": [
   {
    "at": "2026-10-10T04:30:00.000Z",
    "actor": "Priya Natarajan",
    "t": "outreach",
    "title": "Outreach · Member (MAC)",
    "outcome": "Discussed daily medication routine and timing",
    "outcomeColor": "var(--status-success)",
    "note": "Set up pill organizer reminder."
   },
   {
    "at": "2026-09-22T05:30:00.000Z",
    "actor": "Priya Natarajan",
    "t": "outreach",
    "title": "Outreach · Pharmacy (MAC)",
    "outcome": "Confirmed medication pickup date",
    "outcomeColor": "var(--status-success)"
   },
   {
    "at": "2026-09-18T06:30:00.000Z",
    "actor": "Priya Natarajan",
    "t": "outreach",
    "title": "Outreach · Pharmacy (MAC)",
    "outcome": "Pending: Pick up",
    "outcomeColor": "var(--status-error)"
   }
  ],
  "measures": [
   {
    "code": "MAC",
    "pdc": 82,
    "calcPdc": 83,
    "failDate": "11/02/2026",
    "daysLeft": 20,
    "priorYearNonCompliant": false,
    "excluded": false,
    "projectedStatus": null,
    "drugInteraction": false,
    "pickupConfirmed": "09/22/2026",
    "claim": {
     "status": "Paid",
     "date": "08/10/2026",
     "rxNumber": "RX-5520318"
    },
    "nextFillDue": "09/09/2026",
    "medications": [
     {
      "status": "Active",
      "unit": "MG",
      "doseForm": "Tablet",
      "route": "Oral",
      "nonAdherenceReason": "Forgetfulness",
      "notesToMd": "",
      "internalNotes": "",
      "id": "19402-mac-1",
      "name": "Atorvastatin",
      "generic": "atorvastatin",
      "strength": "40",
      "sig": "Take 1 tablet by mouth at bedtime",
      "condition": "Hyperlipidemia",
      "mpr": 83,
      "pdc": 82,
      "qty": 30,
      "daysSupply": 30,
      "lastFill": "08/10/2026",
      "prescriber": {
       "name": "Dr. Helen Park",
       "phone": "(213) 555-0177",
       "fax": "(213) 555-0178",
       "address1": "1866 N Orange Grove Ave Suite 202",
       "city": "Pomona",
       "state": "CA",
       "zip": "91767"
      },
      "pharmacy": {
       "name": "Walgreens #4410",
       "phone": "(213) 555-0120",
       "address1": "1501 W Holt Ave",
       "city": "Pomona",
       "state": "CA",
       "zip": "91768"
      },
      "nextFill": "09/09/2026",
      "refills": [
       {
        "date": "08/10/2026",
        "qty": 30,
        "daysSupply": 30,
        "pharmacy": "Walgreens #4410",
        "prescriber": "Dr. Helen Park",
        "prescriberAddress": "1866 N Orange Grove Ave Suite 202, Pomona, CA, 91767"
       },
       {
        "date": "07/08/2026",
        "qty": 30,
        "daysSupply": 30,
        "pharmacy": "Walgreens #4410",
        "prescriber": "Dr. Helen Park",
        "prescriberAddress": "1866 N Orange Grove Ave Suite 202, Pomona, CA, 91767"
       },
       {
        "date": "06/06/2026",
        "qty": 30,
        "daysSupply": 30,
        "pharmacy": "Walgreens #4410",
        "prescriber": "Dr. Helen Park",
        "prescriberAddress": "1866 N Orange Grove Ave Suite 202, Pomona, CA, 91767"
       },
       {
        "date": "04/29/2026",
        "qty": 30,
        "daysSupply": 30,
        "pharmacy": "Walgreens #4410",
        "prescriber": "Dr. Helen Park",
        "prescriberAddress": "1866 N Orange Grove Ave Suite 202, Pomona, CA, 91767"
       }
      ]
     }
    ]
   }
  ]
 },
 {
  "id": "19403",
  "member_id": "19403",
  "patient_id": "19403",
  "name": "Linda Washington",
  "initials": "LW",
  "gender": "F",
  "age": "74y 2m",
  "dob": "08/19/1952",
  "language": "en",
  "health_plan": "Blue Shield Medicare",
  "ipa": "Prospect Medical Group",
  "book_of_business": "Prospect",
  "status": "In Progress",
  "status_manual": false,
  "assignee_id": null,
  "assignee_name": "Marcus Reyes",
  "assignee_initials": "MR",
  "lead_note": "Needs pharmacist review: plan PDC lower than our fills.",
  "follow_up_due": "10/13/2026",
  "barrier": "Side Effects",
  "days_in_queue": 22,
  "prescriber": {
   "name": "Dr. Samuel Okafor",
   "phone": "(562) 555-0164",
   "fax": "(562) 555-0165",
   "address1": "2801 Atlantic Ave",
   "city": "Long Beach",
   "state": "CA",
   "zip": "90806"
  },
  "pharmacy": {
   "name": "Rite Aid #5532",
   "phone": "(562) 555-0101",
   "address1": "3901 Atlantic Ave",
   "city": "Long Beach",
   "state": "CA",
   "zip": "90807"
  },
  "phones": [
   {
    "number": "(562) 555-0150",
    "label": "Home",
    "doNotUse": false
   }
  ],
  "call_history": [
   {
    "date": "10/09/2026",
    "contact": "Provider Office",
    "outcome": "Refill approval sent to pharmacy",
    "result": "success",
    "by": "Marcus Reyes",
    "note": "Faxed refill request for glipizide.",
    "measures": [
     "MAD"
    ]
   },
   {
    "date": "10/02/2026",
    "contact": "Member",
    "outcome": "Side effects: Experienced",
    "result": "success",
    "by": "Marcus Reyes",
    "note": "Muscle aches on atorvastatin.",
    "measures": [
     "MAC"
    ]
   },
   {
    "date": "09/25/2026",
    "contact": "Member",
    "outcome": "UTC",
    "result": "failed",
    "by": "Marcus Reyes",
    "note": "Left voicemail."
   }
  ],
  "intervention_log": [
   {
    "date": "10/02/2026",
    "by": "Marcus Reyes",
    "note": "Discussed statin side effects; MD to review.",
    "measures": {
     "MAC": {
      "barriers": [
       "Side Effects"
      ],
      "interventions": [
       "Schedule MD Appointment/Labs"
      ],
      "result": "Pending Pharmacist Review"
     },
     "MAD": {
      "barriers": [],
      "interventions": [
       "90/100-day conversion"
      ],
      "result": "Pending Refill Approval"
     }
    }
   }
  ],
  "activity_log": [
   {
    "at": "2026-10-09T04:30:00.000Z",
    "actor": "Marcus Reyes",
    "t": "outreach",
    "title": "Outreach · Provider Office (MAD)",
    "outcome": "Refill approval sent to pharmacy",
    "outcomeColor": "var(--status-success)",
    "note": "Faxed refill request for glipizide."
   },
   {
    "at": "2026-10-02T09:30:00.000Z",
    "actor": "Marcus Reyes",
    "t": "note",
    "title": "Barriers & interventions (MAC, MAD)",
    "note": "MAC: Side Effects, Schedule MD Appointment/Labs, Pending Pharmacist Review\nMAD: 90/100-day conversion, Pending Refill Approval"
   },
   {
    "at": "2026-10-02T05:30:00.000Z",
    "actor": "Marcus Reyes",
    "t": "outreach",
    "title": "Outreach · Member (MAC)",
    "outcome": "Side effects: Experienced",
    "outcomeColor": "var(--status-success)",
    "note": "Muscle aches on atorvastatin."
   },
   {
    "at": "2026-09-25T06:30:00.000Z",
    "actor": "Marcus Reyes",
    "t": "outreach",
    "title": "Outreach · Member",
    "outcome": "UTC",
    "outcomeColor": "var(--status-error)",
    "note": "Left voicemail."
   }
  ],
  "measures": [
   {
    "code": "MAD",
    "pdc": 78,
    "calcPdc": 84,
    "failDate": "11/10/2026",
    "daysLeft": 28,
    "priorYearNonCompliant": true,
    "excluded": false,
    "projectedStatus": null,
    "drugInteraction": true,
    "pickupConfirmed": null,
    "claim": {
     "status": "Paid",
     "date": "09/20/2026",
     "rxNumber": "RX-6610274"
    },
    "nextFillDue": "10/20/2026",
    "medications": [
     {
      "status": "Active",
      "unit": "MG",
      "doseForm": "Tablet",
      "route": "Oral",
      "nonAdherenceReason": null,
      "notesToMd": "",
      "internalNotes": "",
      "id": "19403-mad-1",
      "name": "Glipizide",
      "generic": "glipizide",
      "strength": "5",
      "sig": "Take 1 tablet by mouth before breakfast",
      "condition": "Type 2 diabetes",
      "mpr": 84,
      "pdc": 80,
      "qty": 30,
      "daysSupply": 30,
      "lastFill": "09/20/2026",
      "prescriber": {
       "name": "Dr. Samuel Okafor",
       "phone": "(562) 555-0164",
       "fax": "(562) 555-0165",
       "address1": "2801 Atlantic Ave",
       "city": "Long Beach",
       "state": "CA",
       "zip": "90806"
      },
      "pharmacy": {
       "name": "Rite Aid #5532",
       "phone": "(562) 555-0101",
       "address1": "3901 Atlantic Ave",
       "city": "Long Beach",
       "state": "CA",
       "zip": "90807"
      },
      "nextFill": "10/20/2026",
      "refills": [
       {
        "date": "09/20/2026",
        "qty": 30,
        "daysSupply": 30,
        "pharmacy": "Rite Aid #5532",
        "prescriber": "Dr. Samuel Okafor",
        "prescriberAddress": "2801 Atlantic Ave, Long Beach, CA, 90806"
       },
       {
        "date": "08/12/2026",
        "qty": 30,
        "daysSupply": 30,
        "pharmacy": "Rite Aid #5532",
        "prescriber": "Dr. Samuel Okafor",
        "prescriberAddress": "2801 Atlantic Ave, Long Beach, CA, 90806"
       },
       {
        "date": "07/10/2026",
        "qty": 30,
        "daysSupply": 30,
        "pharmacy": "Rite Aid #5532",
        "prescriber": "Dr. Samuel Okafor",
        "prescriberAddress": "2801 Atlantic Ave, Long Beach, CA, 90806"
       },
       {
        "date": "06/06/2026",
        "qty": 30,
        "daysSupply": 30,
        "pharmacy": "Rite Aid #5532",
        "prescriber": "Dr. Samuel Okafor",
        "prescriberAddress": "2801 Atlantic Ave, Long Beach, CA, 90806"
       }
      ]
     },
     {
      "status": "Active",
      "unit": "MG",
      "doseForm": "Tablet",
      "route": "Oral",
      "nonAdherenceReason": null,
      "notesToMd": "",
      "internalNotes": "",
      "id": "19403-mad-2",
      "name": "Metformin",
      "generic": "metformin",
      "strength": "1000",
      "sig": "Take 1 tablet by mouth twice daily with meals",
      "condition": "Type 2 diabetes",
      "mpr": 86,
      "pdc": 85,
      "qty": 180,
      "daysSupply": 90,
      "lastFill": "08/12/2026",
      "prescriber": {
       "name": "Dr. Samuel Okafor",
       "phone": "(562) 555-0164",
       "fax": "(562) 555-0165",
       "address1": "2801 Atlantic Ave",
       "city": "Long Beach",
       "state": "CA",
       "zip": "90806"
      },
      "pharmacy": {
       "name": "Rite Aid #5532",
       "phone": "(562) 555-0101",
       "address1": "3901 Atlantic Ave",
       "city": "Long Beach",
       "state": "CA",
       "zip": "90807"
      },
      "nextFill": "11/10/2026",
      "refills": [
       {
        "date": "08/12/2026",
        "qty": 180,
        "daysSupply": 90,
        "pharmacy": "Rite Aid #5532",
        "prescriber": "Dr. Samuel Okafor",
        "prescriberAddress": "2801 Atlantic Ave, Long Beach, CA, 90806"
       },
       {
        "date": "05/07/2026",
        "qty": 180,
        "daysSupply": 90,
        "pharmacy": "Rite Aid #5532",
        "prescriber": "Dr. Samuel Okafor",
        "prescriberAddress": "2801 Atlantic Ave, Long Beach, CA, 90806"
       }
      ]
     }
    ]
   },
   {
    "code": "MAC",
    "pdc": 91,
    "calcPdc": 90,
    "failDate": "12/20/2026",
    "daysLeft": 68,
    "priorYearNonCompliant": false,
    "excluded": false,
    "projectedStatus": "Already adherent",
    "drugInteraction": true,
    "oneFillToInvincible": true,
    "pickupConfirmed": null,
    "claim": {
     "status": "Paid",
     "date": "09/28/2026",
     "rxNumber": "RX-6610281"
    },
    "nextFillDue": "10/28/2026",
    "medications": [
     {
      "status": "Active",
      "unit": "MG",
      "doseForm": "Tablet",
      "route": "Oral",
      "nonAdherenceReason": "Side Effects",
      "notesToMd": "Muscle aches: consider switching statin.",
      "internalNotes": "",
      "id": "19403-mac-1",
      "name": "Atorvastatin",
      "generic": "atorvastatin",
      "strength": "20",
      "sig": "Take 1 tablet by mouth at bedtime",
      "condition": "Hyperlipidemia",
      "mpr": 90,
      "pdc": 91,
      "qty": 30,
      "daysSupply": 30,
      "lastFill": "09/28/2026",
      "prescriber": {
       "name": "Dr. Samuel Okafor",
       "phone": "(562) 555-0164",
       "fax": "(562) 555-0165",
       "address1": "2801 Atlantic Ave",
       "city": "Long Beach",
       "state": "CA",
       "zip": "90806"
      },
      "pharmacy": {
       "name": "Rite Aid #5532",
       "phone": "(562) 555-0101",
       "address1": "3901 Atlantic Ave",
       "city": "Long Beach",
       "state": "CA",
       "zip": "90807"
      },
      "nextFill": "10/28/2026",
      "refills": [
       {
        "date": "09/28/2026",
        "qty": 30,
        "daysSupply": 30,
        "pharmacy": "Rite Aid #5532",
        "prescriber": "Dr. Samuel Okafor",
        "prescriberAddress": "2801 Atlantic Ave, Long Beach, CA, 90806"
       },
       {
        "date": "08/28/2026",
        "qty": 30,
        "daysSupply": 30,
        "pharmacy": "Rite Aid #5532",
        "prescriber": "Dr. Samuel Okafor",
        "prescriberAddress": "2801 Atlantic Ave, Long Beach, CA, 90806"
       },
       {
        "date": "07/27/2026",
        "qty": 30,
        "daysSupply": 30,
        "pharmacy": "Rite Aid #5532",
        "prescriber": "Dr. Samuel Okafor",
        "prescriberAddress": "2801 Atlantic Ave, Long Beach, CA, 90806"
       }
      ]
     }
    ]
   }
  ]
 },
 {
  "id": "19404",
  "member_id": "19404",
  "patient_id": "19404",
  "name": "David Nguyen",
  "initials": "DN",
  "gender": "M",
  "age": "66y 1m",
  "dob": "09/05/1960",
  "language": "vi",
  "health_plan": "Humana Gold Plus",
  "ipa": "Astrana IPA",
  "book_of_business": "Astrana",
  "status": "Open",
  "status_manual": false,
  "assignee_id": null,
  "assignee_name": "Priya Natarajan",
  "assignee_initials": "PN",
  "lead_note": null,
  "follow_up_due": "10/16/2026",
  "barrier": null,
  "days_in_queue": 3,
  "prescriber": {
   "name": "Dr. Grace Lin",
   "phone": "(626) 555-0188",
   "fax": "(626) 555-0189",
   "address1": "440 E Huntington Dr",
   "city": "Arcadia",
   "state": "CA",
   "zip": "91006"
  },
  "pharmacy": {
   "name": "CVS Pharmacy #9921",
   "phone": "(626) 555-0190",
   "address1": "255 W Foothill Blvd",
   "city": "Claremont",
   "state": "CA",
   "zip": "91711"
  },
  "phones": [
   {
    "number": "(626) 555-0144",
    "label": "Mobile",
    "doNotUse": false
   }
  ],
  "call_history": [],
  "intervention_log": [],
  "activity_log": [],
  "measures": [
   {
    "code": "MAH",
    "pdc": 86,
    "calcPdc": 86,
    "failDate": "11/18/2026",
    "daysLeft": 36,
    "priorYearNonCompliant": false,
    "excluded": false,
    "projectedStatus": null,
    "drugInteraction": false,
    "pickupConfirmed": null,
    "claim": {
     "status": "Paid",
     "date": "07/17/2026",
     "rxNumber": "RX-7038825"
    },
    "nextFillDue": "10/15/2026",
    "medications": [
     {
      "status": "Active",
      "unit": "MG",
      "doseForm": "Tablet",
      "route": "Oral",
      "nonAdherenceReason": null,
      "notesToMd": "",
      "internalNotes": "",
      "id": "19404-mah-1",
      "name": "Losartan",
      "generic": "losartan",
      "strength": "50",
      "sig": "Take 1 tablet by mouth once daily",
      "condition": "Hypertension",
      "mpr": 86,
      "pdc": 86,
      "qty": 90,
      "daysSupply": 90,
      "lastFill": "07/17/2026",
      "prescriber": {
       "name": "Dr. Grace Lin",
       "phone": "(626) 555-0188",
       "fax": "(626) 555-0189",
       "address1": "440 E Huntington Dr",
       "city": "Arcadia",
       "state": "CA",
       "zip": "91006"
      },
      "pharmacy": {
       "name": "CVS Pharmacy #9921",
       "phone": "(626) 555-0190",
       "address1": "255 W Foothill Blvd",
       "city": "Claremont",
       "state": "CA",
       "zip": "91711"
      },
      "nextFill": "10/15/2026",
      "refills": [
       {
        "date": "07/17/2026",
        "qty": 90,
        "daysSupply": 90,
        "pharmacy": "CVS Pharmacy #9921",
        "prescriber": "Dr. Grace Lin",
        "prescriberAddress": "440 E Huntington Dr, Arcadia, CA, 91006"
       },
       {
        "date": "04/10/2026",
        "qty": 90,
        "daysSupply": 90,
        "pharmacy": "CVS Pharmacy #9921",
        "prescriber": "Dr. Grace Lin",
        "prescriberAddress": "440 E Huntington Dr, Arcadia, CA, 91006"
       }
      ]
     }
    ]
   }
  ]
 },
 {
  "id": "19405",
  "member_id": "19405",
  "patient_id": "19405",
  "name": "Barbara Klein",
  "initials": "BK",
  "gender": "F",
  "age": "79y 6m",
  "dob": "04/14/1947",
  "language": "en",
  "health_plan": "Aetna Medicare Advantage",
  "ipa": "Prospect Medical Group",
  "book_of_business": "Prospect",
  "status": "In Progress",
  "status_manual": false,
  "assignee_id": null,
  "assignee_name": "Marcus Reyes",
  "assignee_initials": "MR",
  "lead_note": "Daughter manages meds: call her line.",
  "follow_up_due": "10/12/2026",
  "barrier": "Transportation",
  "days_in_queue": 31,
  "prescriber": {
   "name": "Dr. Rafael Ortiz",
   "phone": "(714) 555-0122",
   "fax": "(714) 555-0123",
   "address1": "1100 W Stewart Dr",
   "city": "Orange",
   "state": "CA",
   "zip": "92868"
  },
  "pharmacy": {
   "name": "CVS Pharmacy #3301",
   "phone": "(714) 555-0102",
   "address1": "1501 W Chapman Ave",
   "city": "Orange",
   "state": "CA",
   "zip": "92868"
  },
  "phones": [
   {
    "number": "(714) 555-0170",
    "label": "Caregiver",
    "doNotUse": false
   },
   {
    "number": "(714) 555-0171",
    "label": "Home",
    "doNotUse": false
   }
  ],
  "call_history": [
   {
    "date": "10/06/2026",
    "contact": "Caregiver",
    "outcome": "UTC",
    "result": "failed",
    "by": "Marcus Reyes",
    "note": "Left voicemail."
   },
   {
    "date": "09/29/2026",
    "contact": "Pharmacy",
    "outcome": "Pending: Pick up",
    "result": "failed",
    "by": "Marcus Reyes",
    "note": "Fill never picked up; claim reversed.",
    "measures": [
     "MAH"
    ]
   },
   {
    "date": "09/15/2026",
    "contact": "Member",
    "outcome": "UTC",
    "result": "failed",
    "by": "Marcus Reyes",
    "note": ""
   }
  ],
  "intervention_log": [],
  "activity_log": [
   {
    "at": "2026-10-06T04:30:00.000Z",
    "actor": "Marcus Reyes",
    "t": "outreach",
    "title": "Outreach · Caregiver",
    "outcome": "UTC",
    "outcomeColor": "var(--status-error)",
    "note": "Left voicemail."
   },
   {
    "at": "2026-09-29T05:30:00.000Z",
    "actor": "Marcus Reyes",
    "t": "outreach",
    "title": "Outreach · Pharmacy (MAH)",
    "outcome": "Pending: Pick up",
    "outcomeColor": "var(--status-error)",
    "note": "Fill never picked up; claim reversed."
   },
   {
    "at": "2026-09-15T06:30:00.000Z",
    "actor": "Marcus Reyes",
    "t": "outreach",
    "title": "Outreach · Member",
    "outcome": "UTC",
    "outcomeColor": "var(--status-error)"
   }
  ],
  "measures": [
   {
    "code": "MAH",
    "pdc": 74,
    "calcPdc": 72,
    "failDate": "10/20/2026",
    "daysLeft": 7,
    "priorYearNonCompliant": true,
    "excluded": false,
    "projectedStatus": "Unlikely by year end",
    "drugInteraction": false,
    "pickupConfirmed": null,
    "claim": {
     "status": "Reversed",
     "date": "09/28/2026",
     "rxNumber": "RX-8124407"
    },
    "nextFillDue": "09/30/2026",
    "medications": [
     {
      "status": "Active",
      "unit": "MG",
      "doseForm": "Tablet",
      "route": "Oral",
      "nonAdherenceReason": "Transportation",
      "notesToMd": "",
      "internalNotes": "Daughter can pick up Saturdays only.",
      "id": "19405-mah-1",
      "name": "Olmesartan",
      "generic": "olmesartan",
      "strength": "20",
      "sig": "Take 1 tablet by mouth once daily",
      "condition": "Hypertension",
      "mpr": 72,
      "pdc": 74,
      "qty": 60,
      "daysSupply": 60,
      "lastFill": "08/01/2026",
      "prescriber": {
       "name": "Dr. Rafael Ortiz",
       "phone": "(714) 555-0122",
       "fax": "(714) 555-0123",
       "address1": "1100 W Stewart Dr",
       "city": "Orange",
       "state": "CA",
       "zip": "92868"
      },
      "pharmacy": {
       "name": "CVS Pharmacy #3301",
       "phone": "(714) 555-0102",
       "address1": "1501 W Chapman Ave",
       "city": "Orange",
       "state": "CA",
       "zip": "92868"
      },
      "nextFill": "09/30/2026",
      "refills": [
       {
        "date": "08/01/2026",
        "qty": 60,
        "daysSupply": 60,
        "pharmacy": "CVS Pharmacy #3301",
        "prescriber": "Dr. Rafael Ortiz",
        "prescriberAddress": "1100 W Stewart Dr, Orange, CA, 92868"
       },
       {
        "date": "05/19/2026",
        "qty": 60,
        "daysSupply": 60,
        "pharmacy": "CVS Pharmacy #3301",
        "prescriber": "Dr. Rafael Ortiz",
        "prescriberAddress": "1100 W Stewart Dr, Orange, CA, 92868"
       },
       {
        "date": "03/10/2026",
        "qty": 60,
        "daysSupply": 60,
        "pharmacy": "CVS Pharmacy #3301",
        "prescriber": "Dr. Rafael Ortiz",
        "prescriberAddress": "1100 W Stewart Dr, Orange, CA, 92868"
       }
      ]
     }
    ]
   },
   {
    "code": "MAC",
    "pdc": 89,
    "calcPdc": 88,
    "failDate": "12/04/2026",
    "daysLeft": 52,
    "priorYearNonCompliant": false,
    "excluded": false,
    "projectedStatus": null,
    "drugInteraction": false,
    "pickupConfirmed": null,
    "claim": {
     "status": "Paid",
     "date": "07/24/2026",
     "rxNumber": "RX-8124412"
    },
    "nextFillDue": "10/22/2026",
    "medications": [
     {
      "status": "Active",
      "unit": "MG",
      "doseForm": "Tablet",
      "route": "Oral",
      "nonAdherenceReason": null,
      "notesToMd": "",
      "internalNotes": "",
      "id": "19405-mac-1",
      "name": "Simvastatin",
      "generic": "simvastatin",
      "strength": "20",
      "sig": "Take 1 tablet by mouth in the evening",
      "condition": "Hyperlipidemia",
      "mpr": 88,
      "pdc": 89,
      "qty": 90,
      "daysSupply": 90,
      "lastFill": "07/24/2026",
      "prescriber": {
       "name": "Dr. Rafael Ortiz",
       "phone": "(714) 555-0122",
       "fax": "(714) 555-0123",
       "address1": "1100 W Stewart Dr",
       "city": "Orange",
       "state": "CA",
       "zip": "92868"
      },
      "pharmacy": {
       "name": "CVS Pharmacy #3301",
       "phone": "(714) 555-0102",
       "address1": "1501 W Chapman Ave",
       "city": "Orange",
       "state": "CA",
       "zip": "92868"
      },
      "nextFill": "10/22/2026",
      "refills": [
       {
        "date": "07/24/2026",
        "qty": 90,
        "daysSupply": 90,
        "pharmacy": "CVS Pharmacy #3301",
        "prescriber": "Dr. Rafael Ortiz",
        "prescriberAddress": "1100 W Stewart Dr, Orange, CA, 92868"
       },
       {
        "date": "04/20/2026",
        "qty": 90,
        "daysSupply": 90,
        "pharmacy": "CVS Pharmacy #3301",
        "prescriber": "Dr. Rafael Ortiz",
        "prescriberAddress": "1100 W Stewart Dr, Orange, CA, 92868"
       }
      ]
     }
    ]
   }
  ]
 },
 {
  "id": "19406",
  "member_id": "19406",
  "patient_id": "19406",
  "name": "James O’Connor",
  "initials": "JO",
  "gender": "M",
  "age": "70y 0m",
  "dob": "10/10/1956",
  "language": "en",
  "health_plan": "SCAN Classic",
  "ipa": "Astrana IPA",
  "book_of_business": "Astrana",
  "status": "Completed",
  "status_manual": false,
  "assignee_id": null,
  "assignee_name": "Priya Natarajan",
  "assignee_initials": "PN",
  "lead_note": null,
  "follow_up_due": null,
  "barrier": null,
  "days_in_queue": 40,
  "prescriber": {
   "name": "Dr. Helen Park",
   "phone": "(213) 555-0177",
   "fax": "(213) 555-0178",
   "address1": "1866 N Orange Grove Ave Suite 202",
   "city": "Pomona",
   "state": "CA",
   "zip": "91767"
  },
  "pharmacy": {
   "name": "Walgreens #4410",
   "phone": "(213) 555-0120",
   "address1": "1501 W Holt Ave",
   "city": "Pomona",
   "state": "CA",
   "zip": "91768"
  },
  "phones": [
   {
    "number": "(213) 555-0160",
    "label": "Mobile",
    "doNotUse": false
   }
  ],
  "call_history": [
   {
    "date": "09/30/2026",
    "contact": "Pharmacy",
    "outcome": "Confirmed medication pickup date",
    "result": "success",
    "by": "Priya Natarajan",
    "note": "90-day supply picked up.",
    "measures": [
     "MAD"
    ]
   },
   {
    "date": "09/24/2026",
    "contact": "Pharmacy",
    "outcome": "Pending: Pick up",
    "result": "failed",
    "by": "Priya Natarajan",
    "note": "",
    "measures": [
     "MAD"
    ]
   }
  ],
  "intervention_log": [],
  "activity_log": [
   {
    "at": "2026-09-30T04:30:00.000Z",
    "actor": "Priya Natarajan",
    "t": "outreach",
    "title": "Outreach · Pharmacy (MAD)",
    "outcome": "Confirmed medication pickup date",
    "outcomeColor": "var(--status-success)",
    "note": "90-day supply picked up."
   },
   {
    "at": "2026-09-24T05:30:00.000Z",
    "actor": "Priya Natarajan",
    "t": "outreach",
    "title": "Outreach · Pharmacy (MAD)",
    "outcome": "Pending: Pick up",
    "outcomeColor": "var(--status-error)"
   }
  ],
  "measures": [
   {
    "code": "MAD",
    "pdc": 92,
    "calcPdc": 92,
    "failDate": "12/28/2026",
    "daysLeft": 76,
    "priorYearNonCompliant": false,
    "excluded": true,
    "projectedStatus": "Already adherent",
    "drugInteraction": false,
    "pickupConfirmed": "09/30/2026",
    "claim": {
     "status": "Paid",
     "date": "09/30/2026",
     "rxNumber": "RX-9017736"
    },
    "nextFillDue": "12/29/2026",
    "medications": [
     {
      "status": "Active",
      "unit": "MG",
      "doseForm": "Tablet",
      "route": "Oral",
      "nonAdherenceReason": null,
      "notesToMd": "",
      "internalNotes": "",
      "id": "19406-mad-1",
      "name": "Metformin",
      "generic": "metformin",
      "strength": "1000",
      "sig": "Take 1 tablet by mouth twice daily with meals",
      "condition": "Type 2 diabetes",
      "mpr": 92,
      "pdc": 92,
      "qty": 180,
      "daysSupply": 90,
      "lastFill": "09/30/2026",
      "prescriber": {
       "name": "Dr. Helen Park",
       "phone": "(213) 555-0177",
       "fax": "(213) 555-0178",
       "address1": "1866 N Orange Grove Ave Suite 202",
       "city": "Pomona",
       "state": "CA",
       "zip": "91767"
      },
      "pharmacy": {
       "name": "Walgreens #4410",
       "phone": "(213) 555-0120",
       "address1": "1501 W Holt Ave",
       "city": "Pomona",
       "state": "CA",
       "zip": "91768"
      },
      "nextFill": "12/29/2026",
      "refills": [
       {
        "date": "09/30/2026",
        "qty": 180,
        "daysSupply": 90,
        "pharmacy": "Walgreens #4410",
        "prescriber": "Dr. Helen Park",
        "prescriberAddress": "1866 N Orange Grove Ave Suite 202, Pomona, CA, 91767"
       },
       {
        "date": "06/30/2026",
        "qty": 180,
        "daysSupply": 90,
        "pharmacy": "Walgreens #4410",
        "prescriber": "Dr. Helen Park",
        "prescriberAddress": "1866 N Orange Grove Ave Suite 202, Pomona, CA, 91767"
       }
      ]
     }
    ]
   }
  ]
 },
 {
  "id": "19407",
  "member_id": "19407",
  "patient_id": "19407",
  "name": "Sunita Patel",
  "initials": "SP",
  "gender": "F",
  "age": "67y 8m",
  "dob": "02/03/1959",
  "language": "hi",
  "health_plan": "Blue Shield Medicare",
  "ipa": "Astrana IPA",
  "book_of_business": "Astrana",
  "status": "Open",
  "status_manual": false,
  "assignee_id": null,
  "assignee_name": null,
  "assignee_initials": null,
  "lead_note": "Assign to Hindi-speaking coordinator if available.",
  "follow_up_due": null,
  "barrier": null,
  "days_in_queue": 2,
  "prescriber": {
   "name": "Dr. Vikram Shah",
   "phone": "(818) 555-0131",
   "fax": "(818) 555-0132",
   "address1": "18300 Roscoe Blvd",
   "city": "Northridge",
   "state": "CA",
   "zip": "91325"
  },
  "pharmacy": {
   "name": "Costco Pharmacy #112",
   "phone": "(818) 555-0108",
   "address1": "8810 Tampa Ave",
   "city": "Northridge",
   "state": "CA",
   "zip": "91324"
  },
  "phones": [
   {
    "number": "(818) 555-0119",
    "label": "Mobile",
    "doNotUse": false
   }
  ],
  "call_history": [],
  "intervention_log": [],
  "activity_log": [],
  "measures": [
   {
    "code": "MAD",
    "pdc": null,
    "calcPdc": 85,
    "failDate": "11/22/2026",
    "daysLeft": 40,
    "priorYearNonCompliant": false,
    "excluded": false,
    "projectedStatus": null,
    "drugInteraction": false,
    "pickupConfirmed": null,
    "claim": {
     "status": "Paid",
     "date": "09/26/2026",
     "rxNumber": "RX-9150043"
    },
    "nextFillDue": "10/26/2026",
    "medications": [
     {
      "status": "Active",
      "unit": "MG",
      "doseForm": "Tablet",
      "route": "Oral",
      "nonAdherenceReason": null,
      "notesToMd": "",
      "internalNotes": "",
      "id": "19407-mad-1",
      "name": "Metformin",
      "generic": "metformin",
      "strength": "500",
      "sig": "Take 1 tablet by mouth twice daily with meals",
      "condition": "Type 2 diabetes",
      "mpr": 85,
      "pdc": null,
      "qty": 60,
      "daysSupply": 30,
      "lastFill": "09/26/2026",
      "prescriber": {
       "name": "Dr. Vikram Shah",
       "phone": "(818) 555-0131",
       "fax": "(818) 555-0132",
       "address1": "18300 Roscoe Blvd",
       "city": "Northridge",
       "state": "CA",
       "zip": "91325"
      },
      "pharmacy": {
       "name": "Costco Pharmacy #112",
       "phone": "(818) 555-0108",
       "address1": "8810 Tampa Ave",
       "city": "Northridge",
       "state": "CA",
       "zip": "91324"
      },
      "nextFill": "10/26/2026",
      "refills": [
       {
        "date": "09/26/2026",
        "qty": 60,
        "daysSupply": 30,
        "pharmacy": "Costco Pharmacy #112",
        "prescriber": "Dr. Vikram Shah",
        "prescriberAddress": "18300 Roscoe Blvd, Northridge, CA, 91325"
       },
       {
        "date": "08/23/2026",
        "qty": 60,
        "daysSupply": 30,
        "pharmacy": "Costco Pharmacy #112",
        "prescriber": "Dr. Vikram Shah",
        "prescriberAddress": "18300 Roscoe Blvd, Northridge, CA, 91325"
       },
       {
        "date": "07/18/2026",
        "qty": 60,
        "daysSupply": 30,
        "pharmacy": "Costco Pharmacy #112",
        "prescriber": "Dr. Vikram Shah",
        "prescriberAddress": "18300 Roscoe Blvd, Northridge, CA, 91325"
       }
      ]
     }
    ]
   }
  ]
 },
 {
  "id": "19408",
  "member_id": "19408",
  "patient_id": "19408",
  "name": "Thomas Brooks",
  "initials": "TB",
  "gender": "M",
  "age": "72y 3m",
  "dob": "07/09/1954",
  "language": "en",
  "health_plan": "Aetna Medicare Advantage",
  "ipa": "Prospect Medical Group",
  "book_of_business": "Prospect",
  "status": "In Progress",
  "status_manual": false,
  "assignee_id": null,
  "assignee_name": "Marcus Reyes",
  "assignee_initials": "MR",
  "lead_note": null,
  "follow_up_due": "10/17/2026",
  "barrier": "Cost Issue",
  "days_in_queue": 12,
  "prescriber": {
   "name": "Dr. Rafael Ortiz",
   "phone": "(714) 555-0122",
   "fax": "(714) 555-0123",
   "address1": "1100 W Stewart Dr",
   "city": "Orange",
   "state": "CA",
   "zip": "92868"
  },
  "pharmacy": {
   "name": "CVS Pharmacy #3301",
   "phone": "(714) 555-0102",
   "address1": "1501 W Chapman Ave",
   "city": "Orange",
   "state": "CA",
   "zip": "92868"
  },
  "phones": [
   {
    "number": "(714) 555-0181",
    "label": "Mobile",
    "doNotUse": false
   }
  ],
  "call_history": [
   {
    "date": "10/07/2026",
    "contact": "Member",
    "outcome": "Cost/financial barrier",
    "result": "success",
    "by": "Marcus Reyes",
    "note": "Copay $47: asked prescriber about generic.",
    "measures": [
     "MAD"
    ]
   },
   {
    "date": "10/01/2026",
    "contact": "Pharmacy",
    "outcome": "Confirmed medication pickup date",
    "result": "success",
    "by": "Marcus Reyes",
    "note": "Januvia 30-day picked up.",
    "measures": [
     "MAD"
    ]
   }
  ],
  "intervention_log": [
   {
    "date": "10/07/2026",
    "by": "Marcus Reyes",
    "note": "Brand copay $47 on Januvia only; HCTZ combo and pravastatin are $0.",
    "measures": {
     "MAD": {
      "barriers": [
       "Cost Issue"
      ],
      "interventions": [
       "Refill from Manufacturer/Program Assistance"
      ],
      "result": "Rx Pick Up Confirmed"
     },
     "MAC": {
      "barriers": [],
      "interventions": [
       "90/100-day conversion"
      ],
      "result": "Refill Too Soon"
     }
    }
   }
  ],
  "activity_log": [
   {
    "at": "2026-10-07T09:30:00.000Z",
    "actor": "Marcus Reyes",
    "t": "note",
    "title": "Barriers & interventions (MAD, MAC)",
    "note": "MAD: Cost Issue, Refill from Manufacturer/Program Assistance, Rx Pick Up Confirmed\nMAC: 90/100-day conversion, Refill Too Soon"
   },
   {
    "at": "2026-10-07T04:30:00.000Z",
    "actor": "Marcus Reyes",
    "t": "outreach",
    "title": "Outreach · Member (MAD)",
    "outcome": "Cost/financial barrier",
    "outcomeColor": "var(--status-success)",
    "note": "Copay $47: asked prescriber about generic."
   },
   {
    "at": "2026-10-01T05:30:00.000Z",
    "actor": "Marcus Reyes",
    "t": "outreach",
    "title": "Outreach · Pharmacy (MAD)",
    "outcome": "Confirmed medication pickup date",
    "outcomeColor": "var(--status-success)",
    "note": "Januvia 30-day picked up."
   }
  ],
  "measures": [
   {
    "code": "MAD",
    "pdc": 81,
    "calcPdc": 80,
    "failDate": "11/06/2026",
    "daysLeft": 24,
    "priorYearNonCompliant": true,
    "excluded": false,
    "projectedStatus": null,
    "drugInteraction": false,
    "pickupConfirmed": "10/01/2026",
    "claim": {
     "status": "Paid",
     "date": "09/01/2026",
     "rxNumber": "RX-1029584"
    },
    "nextFillDue": "10/01/2026",
    "medications": [
     {
      "status": "Active",
      "unit": "MG",
      "doseForm": "Tablet",
      "route": "Oral",
      "nonAdherenceReason": "Cost Issue",
      "notesToMd": "Brand copay too high: request generic or formulary alternative.",
      "internalNotes": "",
      "id": "19408-mad-1",
      "name": "Januvia",
      "generic": "sitagliptin",
      "strength": "100",
      "sig": "Take 1 tablet by mouth once daily",
      "condition": "Type 2 diabetes",
      "mpr": 80,
      "pdc": 81,
      "qty": 30,
      "daysSupply": 30,
      "lastFill": "09/01/2026",
      "prescriber": {
       "name": "Dr. Rafael Ortiz",
       "phone": "(714) 555-0122",
       "fax": "(714) 555-0123",
       "address1": "1100 W Stewart Dr",
       "city": "Orange",
       "state": "CA",
       "zip": "92868"
      },
      "pharmacy": {
       "name": "CVS Pharmacy #3301",
       "phone": "(714) 555-0102",
       "address1": "1501 W Chapman Ave",
       "city": "Orange",
       "state": "CA",
       "zip": "92868"
      },
      "nextFill": "10/01/2026",
      "refills": [
       {
        "date": "09/01/2026",
        "qty": 30,
        "daysSupply": 30,
        "pharmacy": "CVS Pharmacy #3301",
        "prescriber": "Dr. Rafael Ortiz",
        "prescriberAddress": "1100 W Stewart Dr, Orange, CA, 92868"
       },
       {
        "date": "07/27/2026",
        "qty": 30,
        "daysSupply": 30,
        "pharmacy": "CVS Pharmacy #3301",
        "prescriber": "Dr. Rafael Ortiz",
        "prescriberAddress": "1100 W Stewart Dr, Orange, CA, 92868"
       },
       {
        "date": "06/23/2026",
        "qty": 30,
        "daysSupply": 30,
        "pharmacy": "CVS Pharmacy #3301",
        "prescriber": "Dr. Rafael Ortiz",
        "prescriberAddress": "1100 W Stewart Dr, Orange, CA, 92868"
       },
       {
        "date": "05/17/2026",
        "qty": 30,
        "daysSupply": 30,
        "pharmacy": "CVS Pharmacy #3301",
        "prescriber": "Dr. Rafael Ortiz",
        "prescriberAddress": "1100 W Stewart Dr, Orange, CA, 92868"
       }
      ]
     }
    ]
   },
   {
    "code": "MAH",
    "pdc": 93,
    "calcPdc": 93,
    "failDate": "12/30/2026",
    "daysLeft": 78,
    "priorYearNonCompliant": false,
    "excluded": false,
    "projectedStatus": "Already adherent",
    "drugInteraction": false,
    "oneFillToInvincible": true,
    "pickupConfirmed": null,
    "claim": {
     "status": "Paid",
     "date": "08/07/2026",
     "rxNumber": "RX-1029590"
    },
    "nextFillDue": "11/05/2026",
    "medications": [
     {
      "status": "Active",
      "unit": "MG",
      "doseForm": "Tablet",
      "route": "Oral",
      "nonAdherenceReason": null,
      "notesToMd": "",
      "internalNotes": "",
      "id": "19408-mah-1",
      "name": "Losartan-HCTZ",
      "generic": "losartan / hydrochlorothiazide",
      "strength": "50-12.5",
      "sig": "Take 1 tablet by mouth once daily",
      "condition": "Hypertension",
      "mpr": 93,
      "pdc": 93,
      "qty": 90,
      "daysSupply": 90,
      "lastFill": "08/07/2026",
      "prescriber": {
       "name": "Dr. Rafael Ortiz",
       "phone": "(714) 555-0122",
       "fax": "(714) 555-0123",
       "address1": "1100 W Stewart Dr",
       "city": "Orange",
       "state": "CA",
       "zip": "92868"
      },
      "pharmacy": {
       "name": "CVS Pharmacy #3301",
       "phone": "(714) 555-0102",
       "address1": "1501 W Chapman Ave",
       "city": "Orange",
       "state": "CA",
       "zip": "92868"
      },
      "nextFill": "11/05/2026",
      "refills": [
       {
        "date": "08/07/2026",
        "qty": 90,
        "daysSupply": 90,
        "pharmacy": "CVS Pharmacy #3301",
        "prescriber": "Dr. Rafael Ortiz",
        "prescriberAddress": "1100 W Stewart Dr, Orange, CA, 92868"
       },
       {
        "date": "05/08/2026",
        "qty": 90,
        "daysSupply": 90,
        "pharmacy": "CVS Pharmacy #3301",
        "prescriber": "Dr. Rafael Ortiz",
        "prescriberAddress": "1100 W Stewart Dr, Orange, CA, 92868"
       }
      ]
     }
    ]
   },
   {
    "code": "MAC",
    "pdc": 80,
    "calcPdc": 85,
    "failDate": "11/25/2026",
    "daysLeft": 43,
    "priorYearNonCompliant": false,
    "excluded": false,
    "projectedStatus": null,
    "drugInteraction": false,
    "pickupConfirmed": null,
    "claim": {
     "status": "Paid",
     "date": "07/21/2026",
     "rxNumber": "RX-1029602"
    },
    "nextFillDue": "10/19/2026",
    "medications": [
     {
      "status": "Active",
      "unit": "MG",
      "doseForm": "Tablet",
      "route": "Oral",
      "nonAdherenceReason": null,
      "notesToMd": "",
      "internalNotes": "",
      "id": "19408-mac-1",
      "name": "Pravastatin",
      "generic": "pravastatin",
      "strength": "40",
      "sig": "Take 1 tablet by mouth at bedtime",
      "condition": "Hyperlipidemia",
      "mpr": 85,
      "pdc": 80,
      "qty": 90,
      "daysSupply": 90,
      "lastFill": "07/21/2026",
      "prescriber": {
       "name": "Dr. Rafael Ortiz",
       "phone": "(714) 555-0122",
       "fax": "(714) 555-0123",
       "address1": "1100 W Stewart Dr",
       "city": "Orange",
       "state": "CA",
       "zip": "92868"
      },
      "pharmacy": {
       "name": "CVS Pharmacy #3301",
       "phone": "(714) 555-0102",
       "address1": "1501 W Chapman Ave",
       "city": "Orange",
       "state": "CA",
       "zip": "92868"
      },
      "nextFill": "10/19/2026",
      "refills": [
       {
        "date": "07/21/2026",
        "qty": 90,
        "daysSupply": 90,
        "pharmacy": "CVS Pharmacy #3301",
        "prescriber": "Dr. Rafael Ortiz",
        "prescriberAddress": "1100 W Stewart Dr, Orange, CA, 92868"
       },
       {
        "date": "04/11/2026",
        "qty": 90,
        "daysSupply": 90,
        "pharmacy": "CVS Pharmacy #3301",
        "prescriber": "Dr. Rafael Ortiz",
        "prescriberAddress": "1100 W Stewart Dr, Orange, CA, 92868"
       }
      ]
     }
    ]
   }
  ]
 },
 {
  "id": "19409",
  "member_id": "19409",
  "patient_id": "19409",
  "name": "Angela Hughes",
  "initials": "AH",
  "gender": "F",
  "age": "69y 11m",
  "dob": "11/02/1956",
  "language": "en",
  "health_plan": "Humana Gold Plus",
  "ipa": "Astrana IPA",
  "book_of_business": "Astrana",
  "status": "Open",
  "status_manual": false,
  "assignee_id": null,
  "assignee_name": "Priya Natarajan",
  "assignee_initials": "PN",
  "lead_note": null,
  "follow_up_due": "10/20/2026",
  "barrier": null,
  "days_in_queue": 5,
  "prescriber": {
   "name": "Dr. Alan Choi",
   "phone": "(626) 555-0142",
   "fax": "(626) 555-0143",
   "address1": "1798 N Garey Ave",
   "city": "Pomona",
   "state": "CA",
   "zip": "91767"
  },
  "pharmacy": {
   "name": "Walgreens #2219",
   "phone": "(626) 555-0175",
   "address1": "1 W Duarte Rd",
   "city": "Arcadia",
   "state": "CA",
   "zip": "91007"
  },
  "phones": [
   {
    "number": "(626) 555-0166",
    "label": "Home",
    "doNotUse": false
   }
  ],
  "call_history": [],
  "intervention_log": [],
  "activity_log": [],
  "measures": [
   {
    "code": "MAC",
    "pdc": 90,
    "calcPdc": 88,
    "failDate": "12/12/2026",
    "daysLeft": 60,
    "priorYearNonCompliant": false,
    "excluded": false,
    "projectedStatus": null,
    "drugInteraction": false,
    "pickupConfirmed": null,
    "claim": {
     "status": "Paid",
     "date": "09/24/2026",
     "rxNumber": "RX-2204718"
    },
    "nextFillDue": "10/24/2026",
    "medications": [
     {
      "status": "Active",
      "unit": "MG",
      "doseForm": "Tablet",
      "route": "Oral",
      "nonAdherenceReason": null,
      "notesToMd": "",
      "internalNotes": "",
      "id": "19409-mac-1",
      "name": "Rosuvastatin",
      "generic": "rosuvastatin",
      "strength": "20",
      "sig": "Take 1 tablet by mouth once daily",
      "condition": "Hyperlipidemia",
      "mpr": 88,
      "pdc": 90,
      "qty": 30,
      "daysSupply": 30,
      "lastFill": "09/24/2026",
      "prescriber": {
       "name": "Dr. Alan Choi",
       "phone": "(626) 555-0142",
       "fax": "(626) 555-0143",
       "address1": "1798 N Garey Ave",
       "city": "Pomona",
       "state": "CA",
       "zip": "91767"
      },
      "pharmacy": {
       "name": "Walgreens #2219",
       "phone": "(626) 555-0175",
       "address1": "1 W Duarte Rd",
       "city": "Arcadia",
       "state": "CA",
       "zip": "91007"
      },
      "nextFill": "10/24/2026",
      "refills": [
       {
        "date": "09/24/2026",
        "qty": 30,
        "daysSupply": 30,
        "pharmacy": "Walgreens #2219",
        "prescriber": "Dr. Alan Choi",
        "prescriberAddress": "1798 N Garey Ave, Pomona, CA, 91767"
       },
       {
        "date": "08/23/2026",
        "qty": 30,
        "daysSupply": 30,
        "pharmacy": "Walgreens #2219",
        "prescriber": "Dr. Alan Choi",
        "prescriberAddress": "1798 N Garey Ave, Pomona, CA, 91767"
       },
       {
        "date": "07/21/2026",
        "qty": 30,
        "daysSupply": 30,
        "pharmacy": "Walgreens #2219",
        "prescriber": "Dr. Alan Choi",
        "prescriberAddress": "1798 N Garey Ave, Pomona, CA, 91767"
       }
      ]
     }
    ]
   }
  ]
 },
 {
  "id": "19410",
  "member_id": "19410",
  "patient_id": "19410",
  "name": "Carlos Ramirez",
  "initials": "CR",
  "gender": "M",
  "age": "75y 5m",
  "dob": "05/21/1951",
  "language": "es",
  "health_plan": "SCAN Classic",
  "ipa": "Prospect Medical Group",
  "book_of_business": "Prospect",
  "status": "In Progress",
  "status_manual": false,
  "assignee_id": null,
  "assignee_name": "Marcus Reyes",
  "assignee_initials": "MR",
  "lead_note": null,
  "follow_up_due": "10/14/2026",
  "barrier": null,
  "days_in_queue": 18,
  "prescriber": {
   "name": "Dr. Samuel Okafor",
   "phone": "(562) 555-0164",
   "fax": "(562) 555-0165",
   "address1": "2801 Atlantic Ave",
   "city": "Long Beach",
   "state": "CA",
   "zip": "90806"
  },
  "pharmacy": {
   "name": "Rite Aid #5532",
   "phone": "(562) 555-0101",
   "address1": "3901 Atlantic Ave",
   "city": "Long Beach",
   "state": "CA",
   "zip": "90807"
  },
  "phones": [
   {
    "number": "(562) 555-0158",
    "label": "Mobile",
    "doNotUse": false
   }
  ],
  "call_history": [
   {
    "date": "10/11/2026",
    "contact": "Pharmacy",
    "outcome": "Pending: Pick up",
    "result": "failed",
    "by": "Marcus Reyes",
    "note": "Recheck pickup 10/14.",
    "measures": [
     "MAH"
    ]
   },
   {
    "date": "10/04/2026",
    "contact": "Provider Office",
    "outcome": "Refill approval sent to pharmacy",
    "result": "success",
    "by": "Marcus Reyes",
    "note": "",
    "measures": [
     "MAH"
    ]
   }
  ],
  "intervention_log": [],
  "activity_log": [
   {
    "at": "2026-10-11T04:30:00.000Z",
    "actor": "Marcus Reyes",
    "t": "outreach",
    "title": "Outreach · Pharmacy (MAH)",
    "outcome": "Pending: Pick up",
    "outcomeColor": "var(--status-error)",
    "note": "Recheck pickup 10/14."
   },
   {
    "at": "2026-10-04T05:30:00.000Z",
    "actor": "Marcus Reyes",
    "t": "outreach",
    "title": "Outreach · Provider Office (MAH)",
    "outcome": "Refill approval sent to pharmacy",
    "outcomeColor": "var(--status-success)"
   }
  ],
  "measures": [
   {
    "code": "MAH",
    "pdc": 83,
    "calcPdc": 82,
    "failDate": "10/31/2026",
    "daysLeft": 18,
    "priorYearNonCompliant": false,
    "excluded": false,
    "projectedStatus": null,
    "drugInteraction": false,
    "pickupConfirmed": null,
    "claim": {
     "status": "Paid",
     "date": "08/13/2026",
     "rxNumber": "RX-3381960"
    },
    "nextFillDue": "10/12/2026",
    "medications": [
     {
      "status": "Active",
      "unit": "MG",
      "doseForm": "Tablet",
      "route": "Oral",
      "nonAdherenceReason": null,
      "notesToMd": "",
      "internalNotes": "",
      "id": "19410-mah-1",
      "name": "Valsartan",
      "generic": "valsartan",
      "strength": "80",
      "sig": "Take 1 tablet by mouth once daily",
      "condition": "Hypertension",
      "mpr": 82,
      "pdc": 83,
      "qty": 60,
      "daysSupply": 60,
      "lastFill": "08/13/2026",
      "prescriber": {
       "name": "Dr. Samuel Okafor",
       "phone": "(562) 555-0164",
       "fax": "(562) 555-0165",
       "address1": "2801 Atlantic Ave",
       "city": "Long Beach",
       "state": "CA",
       "zip": "90806"
      },
      "pharmacy": {
       "name": "Rite Aid #5532",
       "phone": "(562) 555-0101",
       "address1": "3901 Atlantic Ave",
       "city": "Long Beach",
       "state": "CA",
       "zip": "90807"
      },
      "nextFill": "10/12/2026",
      "refills": [
       {
        "date": "08/13/2026",
        "qty": 60,
        "daysSupply": 60,
        "pharmacy": "Rite Aid #5532",
        "prescriber": "Dr. Samuel Okafor",
        "prescriberAddress": "2801 Atlantic Ave, Long Beach, CA, 90806"
       },
       {
        "date": "06/09/2026",
        "qty": 60,
        "daysSupply": 60,
        "pharmacy": "Rite Aid #5532",
        "prescriber": "Dr. Samuel Okafor",
        "prescriberAddress": "2801 Atlantic Ave, Long Beach, CA, 90806"
       },
       {
        "date": "04/02/2026",
        "qty": 60,
        "daysSupply": 60,
        "pharmacy": "Rite Aid #5532",
        "prescriber": "Dr. Samuel Okafor",
        "prescriberAddress": "2801 Atlantic Ave, Long Beach, CA, 90806"
       }
      ]
     }
    ]
   }
  ]
 }
]'::jsonb) r
WHERE  NOT EXISTS (
  SELECT 1 FROM public.pharmacy_worklist_members e
  WHERE lower(trim(e.name)) = lower(trim(r.name))
)
ON CONFLICT (id) DO NOTHING;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   DELETE FROM public.pharmacy_worklist_members
--   WHERE id BETWEEN '19401' AND '19410';
