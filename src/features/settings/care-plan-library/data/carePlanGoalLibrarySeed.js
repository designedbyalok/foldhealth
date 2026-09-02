// Structured Care Plan Goals Library
// Generated from structured_care_plan_goals_library.md. Upserted by
// `bun run seed` (onConflict: 'id'). Do not hand-edit — regenerate instead.

export const CARE_PLAN_GOAL_LIBRARY = [
  {
    "id": "d58c571b-0f77-405b-8dd5-32f047e61575",
    "title": "Maintain blood pressure within target",
    "description": "Maintain blood pressure at or below the individualized target.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Hypertension"
    ],
    "comparator": "<=",
    "target_value": "130/80",
    "target_value_2": "",
    "custom_unit": "mmHg",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "d1ff35a1-c266-47b1-80b5-94a35a37cbce",
        "kind": "measure-vital",
        "title": "Blood pressure monitoring"
      },
      {
        "id": "05ddf404-a95b-4eef-8307-5404a232097c",
        "kind": "patient-education",
        "title": "BP technique education"
      },
      {
        "id": "6607ed74-7bf7-4ed9-8ce5-54bb7141560c",
        "kind": "internal-task",
        "title": "BP care-plan review"
      },
      {
        "id": "b65f7f40-54cf-4ed8-8797-4491e596773c",
        "kind": "patient-education",
        "title": "Hypertension education"
      },
      {
        "id": "48e7b2f7-ffa8-4784-8af0-31611ab37c44",
        "kind": "barrier",
        "title": "Difficulty controlling condition"
      },
      {
        "id": "bce42364-15b0-463b-8e7e-bac1c140bb2f",
        "kind": "barrier",
        "title": "Inconsistent self-monitoring"
      },
      {
        "id": "3d5eed2b-ca45-4f37-81af-db50f2cefbe8",
        "kind": "barrier",
        "title": "Limited understanding of target"
      }
    ]
  },
  {
    "id": "5681f593-37ed-4f9e-8e47-f1d95dab03b1",
    "title": "Improve blood pressure control",
    "description": "Reduce average home blood pressure toward the individualized target.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Hypertension"
    ],
    "comparator": "=",
    "target_value": "Decrease average systolic BP by >= 10 mmHg",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "52403562-10f8-4a7b-8c2a-9952fbd1eb83",
        "kind": "measure-vital",
        "title": "Blood pressure monitoring"
      },
      {
        "id": "da25836b-f1ae-40bb-8220-0cb5d427f437",
        "kind": "patient-education",
        "title": "BP technique education"
      },
      {
        "id": "bc045527-78b2-4193-824e-8163e242eee9",
        "kind": "internal-task",
        "title": "BP trend follow-up"
      },
      {
        "id": "b0d6fd8d-d2eb-4c0f-8caf-2b6d404a04be",
        "kind": "barrier",
        "title": "Difficulty controlling condition"
      },
      {
        "id": "e0d1f364-c879-405b-8134-488b544ab563",
        "kind": "barrier",
        "title": "Medication adherence difficulty"
      },
      {
        "id": "1c5f319d-e97e-487b-8b8e-5fb8b158db13",
        "kind": "barrier",
        "title": "Persistent abnormal readings"
      }
    ]
  },
  {
    "id": "101fae43-be58-4f12-8cf7-e58f87c87b21",
    "title": "Monitor blood pressure consistently",
    "description": "Record home blood pressure readings consistently.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Hypertension"
    ],
    "comparator": ">=",
    "target_value": "5",
    "target_value_2": "",
    "custom_unit": "readings/week",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Week",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "ddd6f58c-53dd-4207-83c5-55333d58a139",
        "kind": "measure-vital",
        "title": "Blood pressure monitoring"
      },
      {
        "id": "07877554-9d41-462f-82e0-5e177daf6afd",
        "kind": "measure-vital",
        "title": "Self-monitoring log"
      },
      {
        "id": "2bc14007-deb9-4847-8923-f2fe94f149a3",
        "kind": "barrier",
        "title": "Inconsistent self-monitoring"
      },
      {
        "id": "f87bc285-7745-4223-8b3d-5627ba5895cf",
        "kind": "barrier",
        "title": "Difficulty using monitoring equipment"
      }
    ]
  },
  {
    "id": "853630db-0268-438e-8e5a-46e7d47d8531",
    "title": "Improve medication adherence for hypertension",
    "description": "Take prescribed antihypertensive medications as directed.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Hypertension"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "doses taken",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "1877bdc7-dfbf-4d63-84cb-4680e2465ab2",
        "kind": "patient-education",
        "title": "Medication adherence education"
      },
      {
        "id": "ff926335-cccd-4301-8712-f7b7e0fa9319",
        "kind": "internal-task",
        "title": "Refill support"
      },
      {
        "id": "9dfee89e-9df5-40db-869d-59bfad7f0ef0",
        "kind": "internal-task",
        "title": "Medication reminders"
      },
      {
        "id": "eee9743f-cbec-4e9c-8c36-7a27d384e4b2",
        "kind": "barrier",
        "title": "Medication adherence difficulty"
      },
      {
        "id": "f4eda24b-064d-4db2-8ed4-4ac62439d8fe",
        "kind": "barrier",
        "title": "Complex medication schedule"
      },
      {
        "id": "91eb1528-dbdf-4be4-8bfc-e776fc01a938",
        "kind": "barrier",
        "title": "Forgetfulness"
      }
    ]
  },
  {
    "id": "5dbfcf2a-dbb5-43cb-8bb6-451af62e7000",
    "title": "Reduce cardiovascular risk through activity",
    "description": "Increase regular physical activity according to the patient's care plan.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Cardiovascular risk"
    ],
    "comparator": ">=",
    "target_value": "150",
    "target_value_2": "",
    "custom_unit": "minutes/week",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Week",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "e7c0636b-f1e4-4683-8adb-b30c4fdea920",
        "kind": "internal-task",
        "title": "Activity plan"
      },
      {
        "id": "646e2c9b-2ccc-4a84-848d-3fd512d6d5e6",
        "kind": "patient-education",
        "title": "Activity coaching"
      },
      {
        "id": "ffaae93f-6c8a-4be4-8d36-911bdf0fac88",
        "kind": "barrier",
        "title": "Limited physical activity"
      },
      {
        "id": "412c4c98-f6a7-4b2a-8968-188a419108bf",
        "kind": "barrier",
        "title": "Nutrition challenges"
      },
      {
        "id": "ccd46c73-2449-4fb6-82cf-81fdee24b8e2",
        "kind": "barrier",
        "title": "Physical limitations"
      }
    ]
  },
  {
    "id": "503c3af5-c10e-404b-893d-d4a2412d9e81",
    "title": "Maintain controlled heart rate",
    "description": "Maintain resting heart rate within the individualized target range.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Arrhythmia / cardiovascular disease"
    ],
    "comparator": "=",
    "target_value": "Within prescribed range",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "8c0cf89e-ec85-4309-8d4a-aae542279263",
        "kind": "measure-vital",
        "title": "Heart-rate monitoring"
      },
      {
        "id": "8c710846-0609-4c69-8b35-d4e087470433",
        "kind": "patient-education",
        "title": "Cardiac symptom education"
      },
      {
        "id": "e29f09b0-ab07-4186-8b01-cd8b96253707",
        "kind": "barrier",
        "title": "Variable heart rate"
      },
      {
        "id": "e60a115e-d4ca-4561-815b-12ffe97b1630",
        "kind": "barrier",
        "title": "Difficulty recognizing cardiac symptoms"
      }
    ]
  },
  {
    "id": "cddb545b-6e3f-44d0-8e5b-00e848307ce2",
    "title": "Improve heart failure symptom control",
    "description": "Maintain stable symptoms and promptly identify worsening congestion.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Heart failure"
    ],
    "comparator": "=",
    "target_value": "No unplanned weight gain > 2 lb/24h",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "a27fa7d7-1621-4953-8a84-23567b233e11",
        "kind": "measure-vital",
        "title": "Daily weight monitoring"
      },
      {
        "id": "07a5a880-12bf-44b2-8f96-995c51bd51fb",
        "kind": "internal-task",
        "title": "Heart-failure symptom review"
      },
      {
        "id": "d59ae21a-b98a-44e7-8db2-589c8dca75a6",
        "kind": "internal-task",
        "title": "Escalation coordination"
      },
      {
        "id": "cd889223-52e1-4d37-88d4-9a820f7e12d5",
        "kind": "barrier",
        "title": "Weight-monitoring inconsistency"
      },
      {
        "id": "b8d9fdc8-fdf2-4b4a-8592-0deda4ad1e6e",
        "kind": "barrier",
        "title": "Difficulty following fluid/sodium plan"
      }
    ]
  },
  {
    "id": "6cc22bab-938b-459c-893d-09033fa84184",
    "title": "Monitor daily weight for heart failure",
    "description": "Complete and record daily weights.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Heart failure"
    ],
    "comparator": ">=",
    "target_value": "6",
    "target_value_2": "",
    "custom_unit": "days/week",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Week",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "4c8aa7d5-6ca1-457e-8373-32c5201b64fd",
        "kind": "measure-vital",
        "title": "Daily weight monitoring"
      },
      {
        "id": "68468b27-d65b-4b4f-8499-766139e73a91",
        "kind": "measure-vital",
        "title": "Self-monitoring log"
      },
      {
        "id": "326c8b38-daf7-4cea-8a76-0abe208c3a63",
        "kind": "barrier",
        "title": "Inconsistent self-monitoring"
      },
      {
        "id": "31a8acd4-db09-4d18-823a-39d2cea5a259",
        "kind": "barrier",
        "title": "Difficulty using monitoring equipment"
      },
      {
        "id": "4f340ede-14a6-4d04-8e33-3f95d041d3a7",
        "kind": "barrier",
        "title": "Scale or equipment access"
      }
    ]
  },
  {
    "id": "c73e6acb-92a2-4c07-8996-af07f72dcb4d",
    "title": "Reduce tobacco exposure",
    "description": "Reduce or eliminate tobacco use.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Tobacco use"
    ],
    "comparator": "=",
    "target_value": "0 tobacco use",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "406f2f65-6176-408a-8dcb-41d4afb3d04c",
        "kind": "patient-education",
        "title": "Tobacco-use counseling"
      },
      {
        "id": "f8199096-d947-4d33-8b76-32ac73d93fc7",
        "kind": "internal-task",
        "title": "Tobacco cessation resources"
      },
      {
        "id": "fd0dad38-15f5-4a73-8574-572537f54d63",
        "kind": "patient-education",
        "title": "Tobacco trigger planning"
      },
      {
        "id": "cb909e4a-4137-4c74-84e8-fea8741e1a72",
        "kind": "barrier",
        "title": "Tobacco exposure"
      },
      {
        "id": "80b3ef7f-9706-48bc-8add-a284cb414af7",
        "kind": "barrier",
        "title": "Tobacco cessation difficulty"
      }
    ]
  },
  {
    "id": "011015d6-afbd-4f73-80d6-eed0918e9b24",
    "title": "Improve lipid management",
    "description": "Maintain lipid levels within the individualized treatment target.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Hyperlipidemia"
    ],
    "comparator": "=",
    "target_value": "LDL at individualized target",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Per lab schedule",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "cd51d936-5ff4-46ee-866b-6009aedf893d",
        "kind": "patient-education",
        "title": "Nutrition risk counseling"
      },
      {
        "id": "a0d9423c-ee7b-479d-8c7c-62b3f5e6ed4f",
        "kind": "patient-education",
        "title": "Medication adherence education"
      },
      {
        "id": "57197f1b-2927-4f5d-8166-155e892f3886",
        "kind": "internal-task",
        "title": "Lipid-management follow-up"
      },
      {
        "id": "68329229-a9c0-4493-8afd-ba5ea74b2f09",
        "kind": "barrier",
        "title": "Medication adherence difficulty"
      },
      {
        "id": "1359a685-6aac-4f17-863c-8addec7f5eee",
        "kind": "barrier",
        "title": "Limited understanding of lipid management"
      },
      {
        "id": "10bb880a-1eba-4ccc-83e5-e72e108c2a67",
        "kind": "barrier",
        "title": "Food access limitation"
      }
    ]
  },
  {
    "id": "27eda6dd-1649-41a8-8dc1-4a32695a16ae",
    "title": "Maintain glucose within target range",
    "description": "Maintain blood glucose within the individualized target range.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Diabetes"
    ],
    "comparator": "=",
    "target_value": "Within prescribed range >= 70% of readings",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Per glucose-monitoring plan",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "81a8324e-8dc5-4b30-831c-fa238ad2481e",
        "kind": "patient-education",
        "title": "Diabetes education"
      },
      {
        "id": "e7908c9c-7903-47d6-8203-965a2ecb8aed",
        "kind": "measure-vital",
        "title": "Glucose monitoring support"
      },
      {
        "id": "0c6d6568-bd6a-4e9c-82fc-8eec3ace7c8f",
        "kind": "patient-education",
        "title": "Hypoglycemia education"
      },
      {
        "id": "c2a7a442-973d-4b4f-801b-9ddd202370ff",
        "kind": "barrier",
        "title": "Glucose-monitoring difficulty"
      },
      {
        "id": "d7621b75-7944-49c4-880a-abd02274d46b",
        "kind": "barrier",
        "title": "Glucose variability"
      },
      {
        "id": "96e0117f-604f-4376-8327-92ba94aaaa4f",
        "kind": "barrier",
        "title": "Diabetes self-management complexity"
      }
    ]
  },
  {
    "id": "7446959a-7e00-4f91-8267-aec7b82d83bb",
    "title": "Improve A1C control",
    "description": "Improve A1C toward the individualized treatment goal.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Diabetes"
    ],
    "comparator": "=",
    "target_value": "Decrease A1C by >= 0.5 percentage points",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Every 3 months",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "8fbaa2e1-dbcc-4222-8866-d70815dd030e",
        "kind": "patient-education",
        "title": "Diabetes education"
      },
      {
        "id": "f4fe5573-f968-4144-8bad-e15d0ad87a01",
        "kind": "patient-education",
        "title": "Diabetes nutrition coaching"
      },
      {
        "id": "4c049743-c854-4834-88f5-69bf11823393",
        "kind": "internal-task",
        "title": "A1C follow-up"
      },
      {
        "id": "38f6921b-e929-45cb-8eb6-e8c6148e9614",
        "kind": "barrier",
        "title": "Glucose-monitoring difficulty"
      },
      {
        "id": "e6b8cc96-22d6-4671-8f58-3e28f07fb2e1",
        "kind": "barrier",
        "title": "Limited progress toward A1C target"
      },
      {
        "id": "77a95d8e-4f15-4de8-8b51-6287296efe10",
        "kind": "barrier",
        "title": "Inconsistent diabetes routine"
      }
    ]
  },
  {
    "id": "649d9ac7-e0a8-4c0a-8d49-05c0bf398467",
    "title": "Monitor blood glucose consistently",
    "description": "Complete glucose checks according to the prescribed monitoring plan.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Diabetes"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "of scheduled checks",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Week",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "e1eaedd0-438f-48fa-8e0f-1167917898d7",
        "kind": "measure-vital",
        "title": "Glucose monitoring support"
      },
      {
        "id": "fec9fe4e-e3de-4f0e-8b94-b8b1266b25d6",
        "kind": "measure-vital",
        "title": "Self-monitoring log"
      },
      {
        "id": "1da0eb5c-55e3-4a80-8e44-9d5e84f84d44",
        "kind": "barrier",
        "title": "Inconsistent self-monitoring"
      },
      {
        "id": "8cee3a52-8b0b-4e37-85a6-c38fe601341d",
        "kind": "barrier",
        "title": "Difficulty using monitoring equipment"
      },
      {
        "id": "78d105ea-f25d-4510-85b3-6520b54fef72",
        "kind": "barrier",
        "title": "Glucose-monitoring difficulty"
      }
    ]
  },
  {
    "id": "2c7eda0c-baad-45d1-8a75-e2a466057e4f",
    "title": "Improve diabetes medication adherence",
    "description": "Take diabetes medications according to the treatment plan.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Diabetes"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "doses taken",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "4581bbd7-73bd-417c-897f-ec84181a2f83",
        "kind": "patient-education",
        "title": "Medication adherence education"
      },
      {
        "id": "13d32003-6ed8-43cd-8942-a7d2d729c9d2",
        "kind": "internal-task",
        "title": "Refill support"
      },
      {
        "id": "9346036c-2112-42a6-8771-cfc9d5045fa7",
        "kind": "internal-task",
        "title": "Medication reminders"
      },
      {
        "id": "07b79155-98fd-48aa-8c84-be68681070fc",
        "kind": "barrier",
        "title": "Medication adherence difficulty"
      },
      {
        "id": "6d1ed546-4d23-42ed-8545-f2038bbffdc0",
        "kind": "barrier",
        "title": "Complex medication schedule"
      },
      {
        "id": "e1a53048-2e0e-443a-8991-28c0bc5cc0b6",
        "kind": "barrier",
        "title": "Forgetfulness"
      }
    ]
  },
  {
    "id": "e5a94604-4b4b-49b7-84e6-2805bf3bf33e",
    "title": "Reduce episodes of hypoglycemia",
    "description": "Reduce preventable low blood glucose episodes.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Diabetes"
    ],
    "comparator": "<",
    "target_value": "1",
    "target_value_2": "",
    "custom_unit": "episode/month",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "15a1c7a9-395c-4b2e-8514-a1624637a2d8",
        "kind": "patient-education",
        "title": "Hypoglycemia education"
      },
      {
        "id": "0b2b47b9-10f0-4d72-85ea-d63556678a45",
        "kind": "internal-task",
        "title": "Hypoglycemia review"
      },
      {
        "id": "1e1b8a4a-f687-4f34-852b-e3ceb17552b8",
        "kind": "measure-vital",
        "title": "Glucose pattern review"
      },
      {
        "id": "d50a2ca4-8962-4b24-8e86-f71b6331519d",
        "kind": "barrier",
        "title": "Glucose variability"
      },
      {
        "id": "ad3a8a0b-c1d9-49b3-8754-4b564aee4c48",
        "kind": "barrier",
        "title": "Hypoglycemia risk"
      },
      {
        "id": "80a8b9c6-cda0-420b-830a-0559f9a32d98",
        "kind": "barrier",
        "title": "Difficulty responding to low glucose"
      }
    ]
  },
  {
    "id": "87a3f231-6d79-4d5f-8c4c-25d3abcadd94",
    "title": "Improve nutrition consistency for diabetes",
    "description": "Follow the agreed nutrition plan consistently.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Diabetes"
    ],
    "comparator": ">=",
    "target_value": "5",
    "target_value_2": "",
    "custom_unit": "days/week",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Week",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "458cf63c-9170-47d1-8f05-9623272be903",
        "kind": "patient-education",
        "title": "Diabetes nutrition coaching"
      },
      {
        "id": "a12c7081-a7aa-414e-8073-feb0b303becb",
        "kind": "patient-education",
        "title": "Nutrition coaching"
      },
      {
        "id": "9d7d636d-95ad-4662-84ee-720aad16e58c",
        "kind": "barrier",
        "title": "Nutrition challenges"
      },
      {
        "id": "75e2d12d-7950-48aa-8394-9d67e337ddda",
        "kind": "barrier",
        "title": "Food access limitation"
      },
      {
        "id": "abccb2d3-f29f-43db-8452-fbf062e6e26c",
        "kind": "barrier",
        "title": "Difficulty maintaining meal plan"
      }
    ]
  },
  {
    "id": "2778ff3e-c5f9-4f21-82c6-94e8a7c54785",
    "title": "Increase physical activity for metabolic health",
    "description": "Increase safe physical activity.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Diabetes / obesity"
    ],
    "comparator": ">=",
    "target_value": "150",
    "target_value_2": "",
    "custom_unit": "minutes/week",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Week",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "70f58b43-26c9-437f-869e-88383bd3cf42",
        "kind": "internal-task",
        "title": "Activity plan"
      },
      {
        "id": "36bc58b7-f93d-406d-8a29-666a1cd2d996",
        "kind": "patient-education",
        "title": "Activity coaching"
      },
      {
        "id": "ab2bbf3c-837e-48aa-863a-cf12eabbdc77",
        "kind": "barrier",
        "title": "Limited physical activity"
      },
      {
        "id": "4d256252-a8b2-4ab7-84f5-e0cf89c81054",
        "kind": "barrier",
        "title": "Physical limitations"
      },
      {
        "id": "d06b69cf-7f68-4eee-8dac-f0013a882734",
        "kind": "barrier",
        "title": "Weight-management difficulty"
      }
    ]
  },
  {
    "id": "9bd92904-fd03-4cf0-8cec-05d525e76dca",
    "title": "Improve weight management",
    "description": "Achieve gradual, sustainable weight reduction when clinically appropriate.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Obesity / metabolic risk"
    ],
    "comparator": "=",
    "target_value": "Decrease body weight by 5%",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "3cdc8bbe-2366-4601-8c6f-726240abe821",
        "kind": "patient-education",
        "title": "Nutrition coaching"
      },
      {
        "id": "dac69210-833a-40b3-8ce9-1484a1eb5e0f",
        "kind": "internal-task",
        "title": "Activity plan"
      },
      {
        "id": "d0696ba1-fe6f-4720-8809-849963ff071f",
        "kind": "patient-education",
        "title": "Weight-management coaching"
      },
      {
        "id": "b1eb13db-777f-4d43-8a3a-8e937ac6e174",
        "kind": "barrier",
        "title": "Limited physical activity"
      },
      {
        "id": "56765b8a-207e-4327-8bbf-3560b65a38f1",
        "kind": "barrier",
        "title": "Nutrition challenges"
      },
      {
        "id": "4edb1293-714a-409c-80a6-5d915e57a933",
        "kind": "barrier",
        "title": "Weight-management difficulty"
      }
    ]
  },
  {
    "id": "36da89de-69d9-42fd-86c0-0d741459ce88",
    "title": "Complete routine diabetes monitoring",
    "description": "Complete recommended diabetes monitoring and follow-up.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Diabetes"
    ],
    "comparator": "=",
    "target_value": "100% of scheduled monitoring completed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Per care plan",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "fd5a13a8-fb22-42c8-882b-e75413b184c0",
        "kind": "measure-vital",
        "title": "Lab tracking"
      },
      {
        "id": "55a1ec67-6f53-4175-8fef-6634a816d6f9",
        "kind": "measure-vital",
        "title": "Diabetes monitoring checklist"
      },
      {
        "id": "fc19677e-2432-436a-81ba-a06dbc4d41d7",
        "kind": "barrier",
        "title": "Appointment access issue"
      },
      {
        "id": "be296e7d-97c7-43c5-8ab3-1f6caea0741a",
        "kind": "barrier",
        "title": "Lab access issue"
      }
    ]
  },
  {
    "id": "1cfc03d5-b572-40b5-8f90-c2fcc09eb366",
    "title": "Improve renal risk monitoring",
    "description": "Complete scheduled kidney-function and urine monitoring.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Diabetes / kidney risk"
    ],
    "comparator": "=",
    "target_value": "100% of scheduled tests completed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Per care plan",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "5a0e7a1f-7ca0-44ca-8a2b-f7502cb2ddef",
        "kind": "measure-vital",
        "title": "Lab tracking"
      },
      {
        "id": "cda7b22a-a17c-4952-8500-f57fa29f57e7",
        "kind": "measure-vital",
        "title": "Renal monitoring"
      },
      {
        "id": "c8898687-acd4-4e1b-890e-75467ba3bac8",
        "kind": "barrier",
        "title": "Appointment access issue"
      },
      {
        "id": "32563b0b-63b9-4e00-8d86-e7aaabab5a79",
        "kind": "barrier",
        "title": "Lab access issue"
      },
      {
        "id": "4b6f9db7-5c51-428f-8d40-40d5ee57e759",
        "kind": "barrier",
        "title": "Kidney-monitoring complexity"
      }
    ]
  },
  {
    "id": "c7e2033c-8c3b-4ab4-8fd6-7cc4d671aa85",
    "title": "Improve COPD symptom control",
    "description": "Maintain respiratory symptoms at or below the individualized baseline.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "COPD"
    ],
    "comparator": "=",
    "target_value": "No increase from baseline",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "ad276a5c-91c1-482b-860b-92f25f7604c1",
        "kind": "measure-vital",
        "title": "Respiratory symptom monitoring"
      },
      {
        "id": "0d89a3fd-a27a-4ee5-891f-d5b3e699fc41",
        "kind": "patient-education",
        "title": "Respiratory action-plan education"
      },
      {
        "id": "781665be-08b7-4607-8d41-d66c4e7c9940",
        "kind": "patient-education",
        "title": "COPD self-management support"
      },
      {
        "id": "369990a9-fba6-43ab-89a0-7a7f73e633a1",
        "kind": "barrier",
        "title": "Tobacco exposure"
      },
      {
        "id": "56e8e09a-bcd2-4320-817b-1e701f6686f2",
        "kind": "barrier",
        "title": "Respiratory symptom burden"
      },
      {
        "id": "a20dcca7-7c54-4146-81fa-71e35c167134",
        "kind": "barrier",
        "title": "Respiratory trigger exposure"
      }
    ]
  },
  {
    "id": "2d5b1f3d-63ba-4da7-8d90-0f3dc557ebe3",
    "title": "Improve asthma control",
    "description": "Maintain asthma symptoms within the individualized control plan.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Asthma"
    ],
    "comparator": "<=",
    "target_value": "2",
    "target_value_2": "",
    "custom_unit": "symptom days/week",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "54e67a6d-ad8f-4772-8af5-d80e7af474c6",
        "kind": "patient-education",
        "title": "Respiratory action-plan education"
      },
      {
        "id": "5a0192d2-1b8e-4caf-8486-da2a07245e6b",
        "kind": "patient-education",
        "title": "Asthma action-plan review"
      },
      {
        "id": "7ecc4cad-9ba0-45f4-85b3-4fee4ce4fcf2",
        "kind": "patient-education",
        "title": "Asthma trigger education"
      },
      {
        "id": "bea346ea-5907-4492-858c-3d544f0c4d7d",
        "kind": "barrier",
        "title": "Respiratory symptom burden"
      },
      {
        "id": "490b36b2-4c89-437e-8b77-5709df34c397",
        "kind": "barrier",
        "title": "Difficulty following action plan"
      },
      {
        "id": "08caf996-81c2-4583-899d-e7e626e4b04b",
        "kind": "barrier",
        "title": "Asthma trigger burden"
      }
    ]
  },
  {
    "id": "fdee5ffb-d19d-419b-84cb-edd170ffd56a",
    "title": "Improve inhaler adherence",
    "description": "Use controller inhalers according to the prescribed plan.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "COPD / asthma"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "adherence",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "9c8d4e04-3f45-49f1-8846-78879c2834b7",
        "kind": "patient-education",
        "title": "Medication adherence education"
      },
      {
        "id": "dd55d535-8a25-476b-8391-b7371e9b4746",
        "kind": "patient-education",
        "title": "Inhaler education"
      },
      {
        "id": "6515f77f-ea00-4738-84c7-15b2aed52eef",
        "kind": "barrier",
        "title": "Medication adherence difficulty"
      },
      {
        "id": "9c424ff2-bf18-47c4-872d-43171bed3c66",
        "kind": "barrier",
        "title": "Inhaler adherence difficulty"
      },
      {
        "id": "1518924d-3a32-47ac-81ab-2406b1af54b6",
        "kind": "barrier",
        "title": "Incorrect inhaler technique"
      }
    ]
  },
  {
    "id": "8d479ef1-b56b-4559-86c8-e017cf4e4c20",
    "title": "Improve inhaler technique",
    "description": "Demonstrate correct inhaler technique.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "COPD / asthma"
    ],
    "comparator": "=",
    "target_value": "Correct technique on teach-back",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "30",
    "duration_unit": "Day",
    "frequency": "At education review",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "43ffefc5-69a4-48a9-8de4-e6ce3c64c97a",
        "kind": "patient-education",
        "title": "Inhaler education"
      },
      {
        "id": "e870ea46-6a58-41d7-84e0-96b24de1a0eb",
        "kind": "patient-education",
        "title": "Inhaler teach-back"
      },
      {
        "id": "a0ea2c12-c961-4c82-8e9e-f489b43eb81b",
        "kind": "barrier",
        "title": "Incorrect inhaler technique"
      },
      {
        "id": "d2bfe721-e6fa-4133-857e-c3e047677d5d",
        "kind": "barrier",
        "title": "Difficulty learning equipment technique"
      }
    ]
  },
  {
    "id": "1d9df1a1-37f5-4e47-82ec-6ca7716f1000",
    "title": "Reduce respiratory exacerbations",
    "description": "Reduce preventable exacerbations and urgent respiratory visits.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "COPD / asthma"
    ],
    "comparator": "<",
    "target_value": "1",
    "target_value_2": "",
    "custom_unit": "exacerbation/3 months",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "584a93de-f041-4988-8a8a-9a4db1717dcc",
        "kind": "measure-vital",
        "title": "Respiratory symptom monitoring"
      },
      {
        "id": "83895208-95a8-48c5-8bb4-a4f63560dafa",
        "kind": "patient-education",
        "title": "Respiratory action-plan education"
      },
      {
        "id": "dfd8cc4c-be1e-4117-8959-f80d6964a0f6",
        "kind": "internal-task",
        "title": "Exacerbation prevention"
      },
      {
        "id": "d3fc2b67-e85b-4b91-863c-aa4bb2c50c3d",
        "kind": "barrier",
        "title": "Respiratory symptom burden"
      },
      {
        "id": "7b3cdb6e-ca8b-4d86-873f-b5d7395df1a4",
        "kind": "barrier",
        "title": "Respiratory trigger exposure"
      },
      {
        "id": "ea416cfc-f4ad-4814-8533-07bc3fddbcf3",
        "kind": "barrier",
        "title": "Tobacco exposure"
      }
    ]
  },
  {
    "id": "6b829781-05cc-46bc-8f2a-ec5adcd2176c",
    "title": "Maintain oxygen therapy adherence",
    "description": "Use prescribed oxygen therapy according to the care plan.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Chronic respiratory disease"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "prescribed use",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "fd52f409-4706-4ab0-8ab0-c650420f11e2",
        "kind": "internal-task",
        "title": "Oxygen-use support"
      },
      {
        "id": "9db2dc46-3a7c-41af-8d98-6fb019e50330",
        "kind": "patient-education",
        "title": "Medication adherence education"
      },
      {
        "id": "9c7ecb94-afc8-41a7-87f8-a57a4c8ca1d3",
        "kind": "barrier",
        "title": "Oxygen equipment issue"
      },
      {
        "id": "e9067de7-2f98-45f5-8385-504bda63187d",
        "kind": "barrier",
        "title": "Oxygen-use burden"
      }
    ]
  },
  {
    "id": "772fccf3-fa1d-4fb0-886e-293f96807fef",
    "title": "Improve overall medication adherence",
    "description": "Take medications as prescribed.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Multiple chronic conditions"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "doses taken",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "5d84d527-f7ca-4371-8fae-54957f2515c5",
        "kind": "patient-education",
        "title": "Medication adherence education"
      },
      {
        "id": "6c67f5a3-57d3-4ad4-8d62-f8d812d7ec72",
        "kind": "internal-task",
        "title": "Refill support"
      },
      {
        "id": "22033d33-8b0e-4d00-80b2-ca01896ce203",
        "kind": "internal-task",
        "title": "Medication reminders"
      },
      {
        "id": "1bf8c89a-92a0-4ed6-8702-778fe1500261",
        "kind": "barrier",
        "title": "Medication adherence difficulty"
      },
      {
        "id": "42177b82-c3bb-4f8a-87c4-a9f097b429ab",
        "kind": "barrier",
        "title": "Complex medication schedule"
      },
      {
        "id": "a8ed49c5-1b81-4f21-8486-e33403de81cb",
        "kind": "barrier",
        "title": "Forgetfulness"
      }
    ]
  },
  {
    "id": "829040bf-75ac-4baa-8c13-b4793e25ea6b",
    "title": "Complete medication reconciliation",
    "description": "Maintain an accurate medication list after a care transition.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Medication management"
    ],
    "comparator": "=",
    "target_value": "100% medications reconciled",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "7",
    "duration_unit": "Day",
    "frequency": "After each transition",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "1d7aef58-8fe5-4839-8523-701a476f6621",
        "kind": "internal-task",
        "title": "Medication reconciliation"
      },
      {
        "id": "446a877b-fdd1-4141-8ff1-198e525ce3cf",
        "kind": "internal-task",
        "title": "Medication-list update"
      },
      {
        "id": "d489e19a-69ad-4d5e-8672-3309e35e2b68",
        "kind": "barrier",
        "title": "Medication list discrepancy"
      },
      {
        "id": "07931b12-22d3-4eca-83e2-ef1361150a0c",
        "kind": "barrier",
        "title": "Incomplete care-team communication"
      },
      {
        "id": "182f70a0-a501-40b4-8290-2a29bac6b7af",
        "kind": "barrier",
        "title": "Multiple prescribers"
      }
    ]
  },
  {
    "id": "d79737c5-5df0-4f51-8a0c-a9270a3ce7ca",
    "title": "Resolve medication discrepancies",
    "description": "Resolve identified medication discrepancies with the care team.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Medication management"
    ],
    "comparator": "=",
    "target_value": "100% discrepancies addressed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "7",
    "duration_unit": "Day",
    "frequency": "As identified",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "84cd3185-676e-473f-84fe-be5f28bcf664",
        "kind": "internal-task",
        "title": "Medication reconciliation"
      },
      {
        "id": "7e100f16-d732-4d09-8746-f891756b3b22",
        "kind": "internal-task",
        "title": "Medication issue escalation"
      },
      {
        "id": "a2f380f9-2a1e-47b2-8579-964e9dc0e7bb",
        "kind": "barrier",
        "title": "Medication list discrepancy"
      },
      {
        "id": "371158ce-a441-47f6-8ed7-61efd23431d5",
        "kind": "barrier",
        "title": "Unresolved medication concern"
      }
    ]
  },
  {
    "id": "b477f0b0-491b-4e2f-8653-a00b34e50129",
    "title": "Reduce medication-related adverse effects",
    "description": "Identify and address medication-related adverse effects.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Medication management"
    ],
    "comparator": "=",
    "target_value": "All reported adverse effects reviewed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "b2227fea-9124-40c6-8739-4d3e47707d13",
        "kind": "internal-task",
        "title": "Medication issue escalation"
      },
      {
        "id": "e941a09a-f890-4b02-8f2c-ce83434e1694",
        "kind": "internal-task",
        "title": "Medication review"
      },
      {
        "id": "6fa3d039-02cb-41f0-8268-15140866fef7",
        "kind": "barrier",
        "title": "Medication side effects"
      },
      {
        "id": "4be4af8a-14ab-49c0-89d0-db2a29b69eb1",
        "kind": "barrier",
        "title": "Difficulty reporting side effects"
      }
    ]
  },
  {
    "id": "82f770fe-a6cc-4e73-894c-fb30d5bd8c68",
    "title": "Improve refill continuity",
    "description": "Avoid missed medication doses caused by refill gaps.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Medication management"
    ],
    "comparator": "=",
    "target_value": "0 refill gaps > 2 days",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "a30b8bad-ad3d-4692-8739-962a60bb20f0",
        "kind": "internal-task",
        "title": "Refill support"
      },
      {
        "id": "21d3e05e-a446-43df-8cdf-91a2930559dd",
        "kind": "internal-task",
        "title": "Refill coordination"
      },
      {
        "id": "3aa23632-0920-4c3a-87aa-737ea7f17b9d",
        "kind": "barrier",
        "title": "Refill gap risk"
      },
      {
        "id": "7684a8a9-60f9-4e75-8e1c-4dc442a8392c",
        "kind": "barrier",
        "title": "Pharmacy access issue"
      }
    ]
  },
  {
    "id": "741e6cd2-603f-467e-84ed-f75662658607",
    "title": "Simplify medication routine",
    "description": "Work with the care team to simplify the medication routine when clinically appropriate.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Polypharmacy"
    ],
    "comparator": "=",
    "target_value": "Medication plan reviewed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "591c5b46-6634-4ac0-838c-d1b4247f4286",
        "kind": "internal-task",
        "title": "Medication review"
      },
      {
        "id": "2e574b7b-f297-45e7-83ff-20af5f3282f8",
        "kind": "internal-task",
        "title": "Regimen simplification review"
      },
      {
        "id": "c6fb92ed-6096-4324-88d2-b734918005fd",
        "kind": "barrier",
        "title": "Polypharmacy"
      },
      {
        "id": "543e4b40-d275-4ba4-80a2-733dba38f3e2",
        "kind": "barrier",
        "title": "Complex dosing routine"
      }
    ]
  },
  {
    "id": "e8820f6f-e89f-4f8a-89b0-62b2076d199c",
    "title": "Complete post-discharge follow-up",
    "description": "Complete a timely follow-up after hospital discharge.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Recent hospitalization"
    ],
    "comparator": "=",
    "target_value": "Follow-up completed within 7 days",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "30",
    "duration_unit": "Day",
    "frequency": "Per transition",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "fe001e03-319c-488c-897b-31676f97033b",
        "kind": "internal-task",
        "title": "Post-discharge outreach"
      },
      {
        "id": "815d1406-54bb-45bb-80f8-d2fff2616ed7",
        "kind": "internal-task",
        "title": "Post-discharge appointment coordination"
      },
      {
        "id": "10846474-1fbf-48ce-860d-b0fe3df5316c",
        "kind": "barrier",
        "title": "Appointment access issue"
      },
      {
        "id": "8e0a5ed7-08a2-493a-85fb-af3b53bb31d0",
        "kind": "barrier",
        "title": "Follow-up access issue"
      }
    ]
  },
  {
    "id": "19cee8a8-deb3-4c3c-81b5-53df34b44373",
    "title": "Prevent avoidable readmission",
    "description": "Reduce risk of an avoidable readmission following discharge.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Recent hospitalization"
    ],
    "comparator": "=",
    "target_value": "0 unplanned readmissions within 30 days",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "30",
    "duration_unit": "Day",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "6ac25efd-d21b-4179-8fd5-9262f33a51a1",
        "kind": "internal-task",
        "title": "Post-discharge outreach"
      },
      {
        "id": "c1c7fb07-a3b9-4cd5-8596-499b4f8591b7",
        "kind": "internal-task",
        "title": "Readmission-risk review"
      },
      {
        "id": "b5b25cbd-5fa6-466a-8e2c-5bc309c6ac98",
        "kind": "internal-task",
        "title": "Symptom follow-up"
      },
      {
        "id": "0481bff1-5563-4c9d-8b78-417ab74e98c3",
        "kind": "internal-task",
        "title": "Transition escalation"
      },
      {
        "id": "533bb646-9bdd-46b6-8032-da4cc16531c5",
        "kind": "barrier",
        "title": "Follow-up access issue"
      },
      {
        "id": "35a22149-c6e5-463b-8ff4-b3d9a627513d",
        "kind": "barrier",
        "title": "Unresolved post-discharge needs"
      },
      {
        "id": "885450dc-ed60-4eff-8ed0-9b0d4ee1bd33",
        "kind": "barrier",
        "title": "High readmission risk"
      }
    ]
  },
  {
    "id": "2b1ceed9-9f1e-4718-8c84-e1bf71b9909e",
    "title": "Understand discharge instructions",
    "description": "Demonstrate understanding of discharge instructions and warning signs.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Recent hospitalization"
    ],
    "comparator": "=",
    "target_value": "Teach-back completed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "7",
    "duration_unit": "Day",
    "frequency": "Once after discharge",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "1e38d11d-4c92-4e40-8a41-15d4afeb48b8",
        "kind": "patient-education",
        "title": "Teach-back education"
      },
      {
        "id": "1e89ada1-0c64-4497-8f29-9d4c9dc3ca50",
        "kind": "patient-education",
        "title": "Warning-sign education"
      },
      {
        "id": "ad182965-f07c-4dbb-8eeb-a768d0920a42",
        "kind": "barrier",
        "title": "Limited health literacy"
      },
      {
        "id": "33832789-9c0c-46d8-880f-52918152ebbe",
        "kind": "barrier",
        "title": "Need for repeated education"
      }
    ]
  },
  {
    "id": "729f6631-cac5-4c32-8059-63b2df882baa",
    "title": "Follow post-discharge medication plan",
    "description": "Follow the reconciled post-discharge medication plan.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Recent hospitalization"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "adherence",
    "set_target": true,
    "duration": "30",
    "duration_unit": "Day",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "2c281f9e-0801-4ef1-84e1-a13f5ecd7ab4",
        "kind": "internal-task",
        "title": "Medication reconciliation"
      },
      {
        "id": "aa3439f1-e4ed-47c6-8703-07e33a07182f",
        "kind": "patient-education",
        "title": "Medication adherence education"
      },
      {
        "id": "12033dbb-8724-4373-872f-a931b66e68fb",
        "kind": "patient-education",
        "title": "Teach-back education"
      },
      {
        "id": "f9f4d93c-f4ea-4041-841c-63a9285b2e6d",
        "kind": "barrier",
        "title": "Medication list discrepancy"
      },
      {
        "id": "369f0c2e-56c8-4ca1-88ba-c884ecded3e0",
        "kind": "barrier",
        "title": "Refill gap risk"
      },
      {
        "id": "fadd4a59-7ea3-4c8e-8ab0-959ceecbd875",
        "kind": "barrier",
        "title": "Limited health literacy"
      }
    ]
  },
  {
    "id": "632a2797-cf1c-4572-8eb6-91e996052687",
    "title": "Complete recommended post-discharge services",
    "description": "Complete referrals, labs, therapy, or other services listed in the discharge plan.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Recent hospitalization"
    ],
    "comparator": "=",
    "target_value": "100% priority services completed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "30",
    "duration_unit": "Day",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "bd8d6f4a-d200-47f9-8d31-4a0c88139500",
        "kind": "internal-task",
        "title": "Referral coordination"
      },
      {
        "id": "79c0e677-c94d-46b3-8feb-f27630742f9a",
        "kind": "measure-vital",
        "title": "Appointment tracking"
      },
      {
        "id": "fcb1ae4c-be40-437e-8945-c770fcb56256",
        "kind": "barrier",
        "title": "Appointment access issue"
      },
      {
        "id": "d71ad103-0e19-468d-8856-d21ffddc7e10",
        "kind": "barrier",
        "title": "Lab access issue"
      },
      {
        "id": "0d1e63ef-6f2c-494c-8282-99a24c5f124e",
        "kind": "barrier",
        "title": "Referral completion barrier"
      }
    ]
  },
  {
    "id": "5e167694-3234-4347-88bd-be2f96d101c6",
    "title": "Establish post-discharge care coordination",
    "description": "Ensure key members of the care team have the same post-discharge plan.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Recent hospitalization"
    ],
    "comparator": "=",
    "target_value": "All identified care-team handoffs completed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "14",
    "duration_unit": "Day",
    "frequency": "Per transition",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "d8ead013-091a-4d5d-8417-b532f9a2c0ce",
        "kind": "internal-task",
        "title": "Care-team handoff"
      },
      {
        "id": "35d60cc7-b8e6-478b-8eb6-d45b2ad24d2a",
        "kind": "internal-task",
        "title": "Care-plan handoff documentation"
      },
      {
        "id": "11e53182-a614-4ebf-8d23-023583b83be8",
        "kind": "barrier",
        "title": "Incomplete care-team communication"
      },
      {
        "id": "ec92801a-b6a4-4cfc-8272-698514add4fe",
        "kind": "barrier",
        "title": "Care-team coordination gap"
      }
    ]
  },
  {
    "id": "44ee15fc-2f67-404b-8ba1-8be51e870a4c",
    "title": "Complete annual wellness visit",
    "description": "Complete the annual wellness assessment and update the care plan.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Preventive care"
    ],
    "comparator": "=",
    "target_value": "Visit completed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Month",
    "frequency": "Quarterly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "175ccd17-7c04-4cd2-8cf3-2de687e90e8d",
        "kind": "internal-task",
        "title": "AWV coordination"
      },
      {
        "id": "3755b9c5-0cbc-4f64-8101-839b8db3e6fd",
        "kind": "internal-task",
        "title": "AWV care-plan update"
      },
      {
        "id": "09db0e37-73c9-4afd-80ec-000ff4f65f32",
        "kind": "barrier",
        "title": "Appointment access issue"
      },
      {
        "id": "e986bcb9-1c69-418d-849b-ae76adf5b4d0",
        "kind": "barrier",
        "title": "Follow-up access issue"
      }
    ]
  },
  {
    "id": "6118231d-741d-40a9-852c-8446d897f472",
    "title": "Complete preventive screening plan",
    "description": "Complete age- and risk-appropriate preventive screenings.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Preventive care"
    ],
    "comparator": "=",
    "target_value": "100% of due screenings addressed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Month",
    "frequency": "Quarterly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "770437bc-c78f-48ac-89c8-620d16825839",
        "kind": "measure-vital",
        "title": "Lab tracking"
      },
      {
        "id": "c3575745-e0eb-4a67-8d59-5414866d1a54",
        "kind": "measure-vital",
        "title": "Preventive screening tracking"
      },
      {
        "id": "ba05fd97-db66-48db-8203-fc7434b031e5",
        "kind": "barrier",
        "title": "Appointment access issue"
      },
      {
        "id": "b3bf3314-f0ef-492d-8978-4e72b5fd2b0e",
        "kind": "barrier",
        "title": "Lab access issue"
      },
      {
        "id": "9dc2308b-fdfc-4779-8987-51a68218f5ad",
        "kind": "barrier",
        "title": "Referral completion barrier"
      }
    ]
  },
  {
    "id": "7ca0c022-cb98-4014-86f3-6ffaa608665f",
    "title": "Complete immunization review",
    "description": "Review immunization status and complete indicated vaccinations.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Preventive care"
    ],
    "comparator": "=",
    "target_value": "100% of due vaccines addressed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Month",
    "frequency": "Quarterly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "a68924bc-7279-4b18-8382-85dce3a4b959",
        "kind": "internal-task",
        "title": "Immunization review"
      },
      {
        "id": "bc064377-8403-47ef-835f-3c2cdb8a6318",
        "kind": "internal-task",
        "title": "Immunization coordination"
      },
      {
        "id": "27228f03-3e28-4fd2-8f6b-4b721a4d3624",
        "kind": "barrier",
        "title": "Immunization access barrier"
      },
      {
        "id": "74058092-60c4-4bee-8952-110a96dc990c",
        "kind": "barrier",
        "title": "Vaccine hesitancy or uncertainty"
      }
    ]
  },
  {
    "id": "08a4dce6-5a5b-4d66-8269-c67bcb65abe4",
    "title": "Complete fall-risk assessment",
    "description": "Complete a fall-risk assessment and address identified risks.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Fall risk"
    ],
    "comparator": "=",
    "target_value": "Assessment completed and risks addressed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Quarterly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "ecbfe671-7035-496f-885f-75d422bdbd65",
        "kind": "patient-education",
        "title": "Fall-risk education"
      },
      {
        "id": "23dd03ef-3586-47b6-86f7-c764c5bf6082",
        "kind": "measure-vital",
        "title": "Fall-risk assessment"
      },
      {
        "id": "46c8140a-08e0-48e4-801b-80ee0055b367",
        "kind": "barrier",
        "title": "Fall-risk environment"
      },
      {
        "id": "dfc070dc-2bf0-47d5-8421-a416a3e11ba4",
        "kind": "barrier",
        "title": "Incomplete fall assessment"
      }
    ]
  },
  {
    "id": "04d6e32a-02bd-4ece-8752-d5b0fe85cb0c",
    "title": "Improve fall-prevention behaviors",
    "description": "Follow agreed fall-prevention strategies.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Fall risk"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "adherence",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "54446b77-a53b-4e36-89d6-842fb616766a",
        "kind": "patient-education",
        "title": "Fall-risk education"
      },
      {
        "id": "85b6ebb4-4045-452b-8c26-586d3008936f",
        "kind": "patient-education",
        "title": "Home safety education"
      },
      {
        "id": "593cbd36-d6ab-4eea-8e53-2c07ea343723",
        "kind": "barrier",
        "title": "Fall-risk environment"
      },
      {
        "id": "861c2721-d5e8-447b-8022-3bd54fef4a79",
        "kind": "barrier",
        "title": "Difficulty following safety plan"
      }
    ]
  },
  {
    "id": "67c937b7-7101-4fb8-819a-6d89df1b3406",
    "title": "Complete advance care planning review",
    "description": "Review advance care planning preferences and documentation.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Care planning"
    ],
    "comparator": "=",
    "target_value": "Preferences reviewed and documented",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Month",
    "frequency": "Quarterly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "6d0fecc8-cbf1-4587-869c-2b9f1ab3d57d",
        "kind": "patient-education",
        "title": "Advance-care-planning review"
      },
      {
        "id": "e0b173b0-7628-41c1-8095-8ac57f3f676d",
        "kind": "internal-task",
        "title": "Advance-care-plan documentation"
      },
      {
        "id": "5358eb3f-839d-49ab-869a-031d910be6c5",
        "kind": "barrier",
        "title": "Advance-care-planning uncertainty"
      },
      {
        "id": "ec68b8ff-b2b2-4b36-89aa-b4286db353c8",
        "kind": "barrier",
        "title": "Documentation gap"
      }
    ]
  },
  {
    "id": "e8edf6e8-cf7e-4dc7-8c1d-028f42ec01f7",
    "title": "Establish emergency care plan",
    "description": "Maintain an accessible emergency plan and key contact information.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Care coordination"
    ],
    "comparator": "=",
    "target_value": "Plan documented",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Month",
    "frequency": "Quarterly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "d49aed68-7061-4372-810a-89aaab5abf95",
        "kind": "patient-education",
        "title": "Emergency-plan education"
      },
      {
        "id": "f4b91563-0f99-41fb-81cc-d0fee15f0c59",
        "kind": "internal-task",
        "title": "Emergency-contact review"
      },
      {
        "id": "b83319ab-abf5-4479-8f55-c331346082ad",
        "kind": "barrier",
        "title": "Emergency-plan gap"
      },
      {
        "id": "ccc31edd-b941-4a3e-8b46-44fbdd166f3b",
        "kind": "barrier",
        "title": "Contact-information gap"
      }
    ]
  },
  {
    "id": "0b1dfa2b-d5ea-4575-81e5-d0bb6f9e3211",
    "title": "Maintain ability to perform ADLs",
    "description": "Maintain independence with activities of daily living.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Functional limitation"
    ],
    "comparator": "=",
    "target_value": "No decline from baseline",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "33a9a8f0-a75f-4e1c-8b88-7278dd671fd4",
        "kind": "measure-vital",
        "title": "Functional assessment"
      },
      {
        "id": "c4988d2d-5520-48ce-894c-1cc483df461f",
        "kind": "patient-education",
        "title": "ADL support planning"
      },
      {
        "id": "168f44f6-7116-4d13-84cd-adc6a92de8f5",
        "kind": "barrier",
        "title": "Functional limitation"
      },
      {
        "id": "bdd392f2-c87f-4d8f-863b-ca6186a9a18c",
        "kind": "barrier",
        "title": "Need for caregiver assistance"
      }
    ]
  },
  {
    "id": "03835872-38c7-493d-8c35-61ae965a8d54",
    "title": "Improve mobility",
    "description": "Improve safe mobility within the patient's individualized capacity.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Mobility limitation"
    ],
    "comparator": "=",
    "target_value": "Increase walking/activity by 10% from baseline",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Week",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "3713892e-1adf-498a-8cb3-4474d07c0858",
        "kind": "internal-task",
        "title": "Activity plan"
      },
      {
        "id": "27591e3a-cd9d-4122-8661-fbaff0a06023",
        "kind": "measure-vital",
        "title": "Functional assessment"
      },
      {
        "id": "bc05a74b-e4dd-49a3-8106-e9491a6a14af",
        "kind": "patient-education",
        "title": "Mobility coaching"
      },
      {
        "id": "b0c42d48-0418-498e-8c46-c47b2fdbc3d6",
        "kind": "barrier",
        "title": "Limited physical activity"
      },
      {
        "id": "e76ec93b-faf8-4508-8e53-ab535407ea29",
        "kind": "barrier",
        "title": "Functional limitation"
      },
      {
        "id": "2437799a-fa28-4613-8ea6-6e09fd10f816",
        "kind": "barrier",
        "title": "Mobility limitation"
      }
    ]
  },
  {
    "id": "ca6c08f8-6792-4bff-8f8f-128c95e16186",
    "title": "Improve balance",
    "description": "Improve balance and safe movement.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Fall risk"
    ],
    "comparator": "=",
    "target_value": "Complete prescribed balance activities >= 3 days/week",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Week",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "568b9a05-329d-4900-89f2-fd4167b1801e",
        "kind": "patient-education",
        "title": "Mobility coaching"
      },
      {
        "id": "9652a02d-2cf9-4566-853e-ea7d6d84084c",
        "kind": "internal-task",
        "title": "Balance exercise support"
      },
      {
        "id": "6d7efe02-e06a-4100-8d85-5d067d36d67d",
        "kind": "barrier",
        "title": "Fall-risk environment"
      },
      {
        "id": "498b7eac-b1cc-410f-8f32-8b4664237945",
        "kind": "barrier",
        "title": "Mobility limitation"
      }
    ]
  },
  {
    "id": "3419b5a3-c77c-44e6-83a5-d7d9c24fcaa9",
    "title": "Maintain appropriate assistive-device use",
    "description": "Use the prescribed assistive device safely and consistently.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Mobility limitation"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "of applicable activities",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "9f0c70e2-a7ff-4253-84dc-cc2beba3f42f",
        "kind": "patient-education",
        "title": "Assistive-device education"
      },
      {
        "id": "2f6d27ee-de20-457d-89e4-13b4a612f5b3",
        "kind": "internal-task",
        "title": "Assistive-device follow-up"
      },
      {
        "id": "eb7bcfb2-d6e4-47d8-8c81-13dae47e8641",
        "kind": "barrier",
        "title": "Assistive-device difficulty"
      },
      {
        "id": "3c12a425-3def-4a3b-847a-b567e74e073a",
        "kind": "barrier",
        "title": "Equipment access issue"
      }
    ]
  },
  {
    "id": "f20121b4-0780-4dcc-835d-a7db116b5f24",
    "title": "Increase independence with self-care",
    "description": "Improve independence with selected self-care activities.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Functional limitation"
    ],
    "comparator": "=",
    "target_value": "Improve by 1 functional level",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "5b488a25-3469-4634-864a-8b364b8ec022",
        "kind": "measure-vital",
        "title": "Functional assessment"
      },
      {
        "id": "fb3d9beb-6dff-442b-8e64-cb5378074d7e",
        "kind": "patient-education",
        "title": "Self-care coaching"
      },
      {
        "id": "c7f0b01b-6d50-4942-8bb0-5295a32842da",
        "kind": "barrier",
        "title": "Functional limitation"
      },
      {
        "id": "2b7cc268-8d37-482f-8c8f-d0e6d4061f34",
        "kind": "barrier",
        "title": "Need for caregiver assistance"
      },
      {
        "id": "53ae1771-ef31-42a8-8eae-8b291f39fccb",
        "kind": "barrier",
        "title": "Reduced self-care independence"
      }
    ]
  },
  {
    "id": "15f398de-d51c-4be9-81d7-1c867200231e",
    "title": "Maintain adequate hydration",
    "description": "Follow the individualized hydration plan.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Hydration risk"
    ],
    "comparator": "=",
    "target_value": "Meet prescribed daily fluid goal",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "3443822b-90b8-449a-8418-004e3d840b1c",
        "kind": "patient-education",
        "title": "Hydration education"
      },
      {
        "id": "101227b1-a19d-4760-89b9-0905e38c4989",
        "kind": "measure-vital",
        "title": "Nutrition/hydration monitoring"
      },
      {
        "id": "33aef091-8981-426e-86c6-0b2946861af5",
        "kind": "barrier",
        "title": "Hydration challenge"
      },
      {
        "id": "cac18de2-9c64-4dfc-843c-b7b7566cbff5",
        "kind": "barrier",
        "title": "Fluid-plan complexity"
      }
    ]
  },
  {
    "id": "b5709052-110e-4ce8-8570-6518908f1c37",
    "title": "Improve nutritional intake",
    "description": "Improve consistency and adequacy of nutritional intake.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Nutrition risk"
    ],
    "comparator": ">=",
    "target_value": "3",
    "target_value_2": "",
    "custom_unit": "planned meals/day",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Week",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "62c1988f-9a5a-4c46-8e05-6ab5deaca36c",
        "kind": "patient-education",
        "title": "Nutrition coaching"
      },
      {
        "id": "c3f08788-0c55-4413-8fa3-00ba28962463",
        "kind": "internal-task",
        "title": "Nutrition support"
      },
      {
        "id": "cf1df334-aca9-4b73-8752-caacc194c934",
        "kind": "barrier",
        "title": "Poor appetite"
      },
      {
        "id": "eff4ba17-eb12-42de-8cd6-699cfbd7e301",
        "kind": "barrier",
        "title": "Difficulty preparing meals"
      },
      {
        "id": "869fec29-6bd0-48bb-8fea-a442d7e472b5",
        "kind": "barrier",
        "title": "Limited nutrition knowledge"
      }
    ]
  },
  {
    "id": "3c90c65b-6209-41df-82a5-c462a1eb2250",
    "title": "Prevent unintended weight loss",
    "description": "Maintain weight within the individualized acceptable range.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Nutrition risk"
    ],
    "comparator": "=",
    "target_value": "No unplanned loss > 5%",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "7ad1a7e8-6669-4239-8a8b-d066c658436e",
        "kind": "measure-vital",
        "title": "Nutrition/hydration monitoring"
      },
      {
        "id": "480b92cc-5767-4d79-8c5a-13a00019470a",
        "kind": "internal-task",
        "title": "Nutrition support"
      },
      {
        "id": "4915ff3a-4441-4540-867e-f16a3d417dc6",
        "kind": "measure-vital",
        "title": "Weight monitoring"
      },
      {
        "id": "ac572fa4-2cfd-4c9b-8797-c826108686ba",
        "kind": "barrier",
        "title": "Poor appetite"
      },
      {
        "id": "9c6175b2-86fb-4794-8123-73af17b76c02",
        "kind": "barrier",
        "title": "Unintended weight loss"
      },
      {
        "id": "71902ba9-ed05-417f-8cbe-9be8a79a0a35",
        "kind": "barrier",
        "title": "Nutrition-related functional limitation"
      }
    ]
  },
  {
    "id": "93ede45c-df78-4d06-879b-0ecad62d76e9",
    "title": "Improve nutrition plan adherence",
    "description": "Follow the agreed nutrition plan.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Nutrition risk"
    ],
    "comparator": ">=",
    "target_value": "5",
    "target_value_2": "",
    "custom_unit": "days/week",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Week",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "3f909d17-665d-4042-84a9-4f316f7f9761",
        "kind": "patient-education",
        "title": "Nutrition coaching"
      },
      {
        "id": "a298cd17-fb1e-45b9-810f-79d32b494730",
        "kind": "internal-task",
        "title": "Nutrition support"
      },
      {
        "id": "9445fdca-f4f5-495d-8b4e-55fa428f9d95",
        "kind": "barrier",
        "title": "Nutrition challenges"
      },
      {
        "id": "0b2dec5f-878a-4609-8297-0de866938db8",
        "kind": "barrier",
        "title": "Food access limitation"
      },
      {
        "id": "21038ea8-9e69-46f1-8936-d87445ff4764",
        "kind": "barrier",
        "title": "Poor appetite"
      }
    ]
  },
  {
    "id": "6231e3fe-5eac-46f4-866f-dec1e1691b5c",
    "title": "Improve mood stability",
    "description": "Maintain mood symptoms within the individualized treatment goal.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Behavioral health"
    ],
    "comparator": "=",
    "target_value": "Improvement from baseline score",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "bf8ceb88-93f3-445f-8ac4-d005e16505cf",
        "kind": "internal-task",
        "title": "Behavioral-health follow-up"
      },
      {
        "id": "5750f95d-d2d7-4c8e-87fc-178b3bd14a41",
        "kind": "measure-vital",
        "title": "Mood tracking"
      },
      {
        "id": "945b5867-c7f1-4633-87b1-ab10cf0b471a",
        "kind": "barrier",
        "title": "Mood symptoms"
      },
      {
        "id": "21b9492b-d218-4333-8a2e-7d7a994de08d",
        "kind": "barrier",
        "title": "Behavioral-health access"
      }
    ]
  },
  {
    "id": "760b89aa-0807-4d7b-8711-dc7b6954806e",
    "title": "Improve adherence to behavioral-health treatment",
    "description": "Follow the agreed behavioral-health treatment plan.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Behavioral health"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "adherence",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "6a10a233-63c3-4a09-8d67-e79785985991",
        "kind": "internal-task",
        "title": "Behavioral-health follow-up"
      },
      {
        "id": "1437e0f7-ee3e-4576-80c2-0d55254d1628",
        "kind": "patient-education",
        "title": "Medication adherence education"
      },
      {
        "id": "73447b4d-76ea-44c3-84ab-3de8c24ac093",
        "kind": "barrier",
        "title": "Treatment engagement difficulty"
      },
      {
        "id": "a044b42c-7fdb-4291-807f-eb9db9266950",
        "kind": "barrier",
        "title": "Behavioral-health stigma or concern"
      }
    ]
  },
  {
    "id": "935d15d4-0a10-484d-8616-920810962a2c",
    "title": "Maintain cognitive safety plan",
    "description": "Maintain an effective support and safety plan.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Cognitive impairment"
    ],
    "comparator": "=",
    "target_value": "Plan reviewed and current",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "4f96cdb7-469e-426f-8cd0-e0f997b35f3c",
        "kind": "patient-education",
        "title": "Cognitive support planning"
      },
      {
        "id": "a448c09b-b9d2-43ca-82f8-19ab16dfdb04",
        "kind": "internal-task",
        "title": "Cognitive safety review"
      },
      {
        "id": "52950bbf-caed-4075-8f3e-506485e98a31",
        "kind": "barrier",
        "title": "Cognitive impairment"
      },
      {
        "id": "3c87d43c-cff4-4fbb-8d01-29c2580a50c8",
        "kind": "barrier",
        "title": "Safety-awareness limitation"
      }
    ]
  },
  {
    "id": "21e2e7d8-4c67-4720-8023-5bd934dbf916",
    "title": "Improve appointment and medication organization",
    "description": "Use an agreed organizational system for medications and appointments.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Cognitive / functional support"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "scheduled tasks completed",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "e3df7ef6-b98f-444d-8a34-3697caec5746",
        "kind": "internal-task",
        "title": "Refill support"
      },
      {
        "id": "f598631c-33df-4ed9-829f-3b99b061782c",
        "kind": "internal-task",
        "title": "Organization tools"
      },
      {
        "id": "76d3ea90-fd2f-41f9-8d97-fbe5c290c711",
        "kind": "barrier",
        "title": "Cognitive impairment"
      },
      {
        "id": "ce414361-dc76-49c1-8141-cf5b4006c735",
        "kind": "barrier",
        "title": "Organizational difficulty"
      }
    ]
  },
  {
    "id": "0efb1a4f-1a00-4cc3-8a23-b881b6807641",
    "title": "Increase social engagement",
    "description": "Increase meaningful social connection.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Social isolation"
    ],
    "comparator": ">=",
    "target_value": "2",
    "target_value_2": "",
    "custom_unit": "meaningful contacts/week",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Week",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "7b38fbb4-9937-4e10-8dcf-4c8101a8a4ba",
        "kind": "patient-education",
        "title": "Social-connection planning"
      },
      {
        "id": "26e08e9e-518d-4b53-81b3-507995244f2c",
        "kind": "internal-task",
        "title": "Community-engagement referral"
      },
      {
        "id": "8097b27d-ea9b-4352-867c-c2f52a10d2a5",
        "kind": "barrier",
        "title": "Limited social network"
      },
      {
        "id": "88351a3a-928f-455f-8160-2bcf8e572694",
        "kind": "barrier",
        "title": "Social isolation"
      }
    ]
  },
  {
    "id": "62fef7fd-2e89-4cbf-84c8-bfe455d33123",
    "title": "Improve chronic pain control",
    "description": "Reduce pain to the patient's individualized acceptable level.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Chronic pain"
    ],
    "comparator": "=",
    "target_value": "Decrease average pain score by >= 2 points",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "02e7f498-c227-4fde-80b5-564d01dfef51",
        "kind": "measure-vital",
        "title": "Pain assessment"
      },
      {
        "id": "6a317190-03c8-43a5-8b10-b9023154e983",
        "kind": "measure-vital",
        "title": "Non-pharmacologic pain support"
      },
      {
        "id": "39850447-c78e-453f-8e68-6eded8f8d3a4",
        "kind": "internal-task",
        "title": "Pain-care coordination"
      },
      {
        "id": "26ab02a0-fc22-4725-8a4a-e41b64e05d19",
        "kind": "barrier",
        "title": "Chronic pain burden"
      },
      {
        "id": "744988e5-c812-48f1-868d-a02628220f4b",
        "kind": "barrier",
        "title": "Limited response to current pain plan"
      }
    ]
  },
  {
    "id": "4765553e-736f-45b3-8c84-1c9c98605ecb",
    "title": "Improve pain-related function",
    "description": "Improve ability to perform selected daily activities despite pain.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Chronic pain"
    ],
    "comparator": "=",
    "target_value": "Increase functional activity by 20%",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Week",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "b0e1c707-d874-4dba-8745-9da34f98d6a1",
        "kind": "measure-vital",
        "title": "Pain assessment"
      },
      {
        "id": "d1f39aab-af51-4757-880d-da9070055934",
        "kind": "patient-education",
        "title": "Mobility coaching"
      },
      {
        "id": "32950d82-e64d-4b1d-838b-6094470f88b3",
        "kind": "barrier",
        "title": "Functional limitation"
      },
      {
        "id": "c9678eab-ed01-4369-88cb-b1a75719b472",
        "kind": "barrier",
        "title": "Chronic pain burden"
      }
    ]
  },
  {
    "id": "a87d36a8-a644-49a1-80d0-ae7d5350c8b7",
    "title": "Reduce reliance on rescue interventions",
    "description": "Reduce frequency of rescue medication or urgent symptom interventions when clinically appropriate.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Chronic symptoms"
    ],
    "comparator": "=",
    "target_value": "Decrease rescue use by 25%",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "930696d9-0cca-4ebb-8c1a-7e7cd2315737",
        "kind": "measure-vital",
        "title": "Non-pharmacologic pain support"
      },
      {
        "id": "4997ac07-49b9-499b-81c7-69103b7a9def",
        "kind": "measure-vital",
        "title": "Rescue-use tracking"
      },
      {
        "id": "fa3fabe9-f27a-4a18-892b-fb5982e59f76",
        "kind": "barrier",
        "title": "Chronic pain burden"
      },
      {
        "id": "8721d169-59e2-4e66-8d5e-b944abafa990",
        "kind": "barrier",
        "title": "Frequent rescue use"
      }
    ]
  },
  {
    "id": "804ed3c5-b5d9-4f4f-87b2-322fb68ba0d1",
    "title": "Maintain kidney function monitoring",
    "description": "Complete scheduled kidney-function monitoring.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Chronic kidney disease"
    ],
    "comparator": "=",
    "target_value": "100% scheduled labs completed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Per care plan",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "7af4c16c-13a5-4d63-839a-95dd1d057beb",
        "kind": "measure-vital",
        "title": "Lab tracking"
      },
      {
        "id": "2008a96f-25fc-4ddf-8285-b97d8877adf2",
        "kind": "measure-vital",
        "title": "Renal monitoring"
      },
      {
        "id": "b04c762c-b22d-4c87-8e62-6cb80c0925f7",
        "kind": "barrier",
        "title": "Appointment access issue"
      },
      {
        "id": "c7c2a5c1-871a-49a3-8217-22105a37339f",
        "kind": "barrier",
        "title": "Lab access issue"
      }
    ]
  },
  {
    "id": "87448feb-c543-4d5d-804e-c98c93a0ca6e",
    "title": "Maintain individualized renal-protection plan",
    "description": "Follow the individualized renal-protection care plan.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Chronic kidney disease"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "plan adherence",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "62044bda-736c-4597-8c0b-5570fea304e7",
        "kind": "patient-education",
        "title": "Medication adherence education"
      },
      {
        "id": "f6affbe7-2199-4f39-8588-b4fa4fe29259",
        "kind": "patient-education",
        "title": "Chronic kidney disease education"
      },
      {
        "id": "71083b93-0ff6-4abc-8a3c-b8dbf2516f07",
        "kind": "internal-task",
        "title": "Renal risk-factor support"
      },
      {
        "id": "22e0eb92-4f2e-463a-87ea-7d799441b0de",
        "kind": "barrier",
        "title": "Medication adherence difficulty"
      },
      {
        "id": "90ef2ee5-7579-4372-8886-c064414950b0",
        "kind": "barrier",
        "title": "Nutrition challenges"
      },
      {
        "id": "ea1424c8-bb70-4736-8f23-b205e7f017c3",
        "kind": "barrier",
        "title": "Food access limitation"
      }
    ]
  },
  {
    "id": "ea0d2892-97cb-4226-8bd5-8b0550328bfb",
    "title": "Monitor for worsening chronic disease symptoms",
    "description": "Identify changes in symptoms early and communicate them to the care team.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Chronic disease"
    ],
    "comparator": "=",
    "target_value": "100% significant changes reported per plan",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "6b28357b-d9b7-472a-8509-41ea97a06605",
        "kind": "measure-vital",
        "title": "Self-monitoring log"
      },
      {
        "id": "9b8f5275-9d2a-49e3-87ee-253d5fb6c14f",
        "kind": "patient-education",
        "title": "Symptom escalation education"
      },
      {
        "id": "d1624719-8375-4869-8caf-444c6771d7dd",
        "kind": "barrier",
        "title": "Inconsistent self-monitoring"
      },
      {
        "id": "a35d1443-fc18-481e-80f6-8c3fcb601ac3",
        "kind": "barrier",
        "title": "Difficulty recognizing symptom changes"
      },
      {
        "id": "a15abd3f-6dd3-4ed7-88ba-fc66f56dd080",
        "kind": "barrier",
        "title": "Delayed symptom reporting"
      }
    ]
  },
  {
    "id": "177d7904-fd06-4639-84a3-ec6a46808a22",
    "title": "Support wound healing",
    "description": "Promote healing according to the wound-care plan.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Wound"
    ],
    "comparator": "=",
    "target_value": "Wound size decreases from baseline",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "8",
    "duration_unit": "Week",
    "frequency": "Per wound-care schedule",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "f6268d0a-377f-420c-8316-67cf98f3023b",
        "kind": "patient-education",
        "title": "Wound-care education"
      },
      {
        "id": "b3cc48aa-3a65-4562-8771-eb28fee80c20",
        "kind": "measure-vital",
        "title": "Wound measurement tracking"
      },
      {
        "id": "56b1239c-ba93-4b13-860a-00f90ab92a8f",
        "kind": "internal-task",
        "title": "Wound-care coordination"
      },
      {
        "id": "ddf80088-f97b-41ec-8c77-dc16733cd6b7",
        "kind": "barrier",
        "title": "Wound-care complexity"
      },
      {
        "id": "968811bd-10e1-4d59-80fc-460b7c03ffca",
        "kind": "barrier",
        "title": "Delayed wound healing"
      }
    ]
  },
  {
    "id": "60d07eb6-93d5-44db-80fd-98ffcead8caf",
    "title": "Complete wound-care regimen",
    "description": "Complete prescribed wound-care activities.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Wound"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "adherence",
    "set_target": true,
    "duration": "8",
    "duration_unit": "Week",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "2489763c-1058-4d95-8f87-a10e53adcd96",
        "kind": "patient-education",
        "title": "Wound-care education"
      },
      {
        "id": "0ea0b23b-5b37-4aa1-8258-14cd0e5cbcf4",
        "kind": "internal-task",
        "title": "Wound adherence support"
      },
      {
        "id": "ffa0e269-6e32-453e-8598-72ab223ed975",
        "kind": "barrier",
        "title": "Complex medication schedule"
      },
      {
        "id": "8a40c7b2-1c69-4283-8c0c-99b0d97da88e",
        "kind": "barrier",
        "title": "Wound-care complexity"
      },
      {
        "id": "f73ddf42-7136-4bfa-852b-776810a32fac",
        "kind": "barrier",
        "title": "Wound-care adherence difficulty"
      }
    ]
  },
  {
    "id": "50d09fd1-856e-4183-845c-2daf1d6451d5",
    "title": "Reduce risk of skin breakdown",
    "description": "Follow the skin-protection and repositioning plan.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Pressure injury risk"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "adherence",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "b19f650c-de43-480a-82fa-abb40d4b745e",
        "kind": "patient-education",
        "title": "Skin-protection education"
      },
      {
        "id": "16798219-e5d4-461f-88fe-0e70f7450149",
        "kind": "internal-task",
        "title": "Repositioning support"
      },
      {
        "id": "3deddb19-965a-4dc4-8d61-a7935d0e1cb4",
        "kind": "barrier",
        "title": "Functional limitation"
      },
      {
        "id": "249a2898-bdd2-4864-8939-b41a37197ac5",
        "kind": "barrier",
        "title": "Wound-care complexity"
      },
      {
        "id": "7224ac0c-268c-4ac1-87d0-adb874b23359",
        "kind": "barrier",
        "title": "Pressure-injury risk"
      }
    ]
  },
  {
    "id": "a502f391-4c55-4cfe-8e15-9f37ab6d6bd8",
    "title": "Complete specialty follow-up",
    "description": "Complete scheduled specialty follow-up.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Care coordination"
    ],
    "comparator": "=",
    "target_value": "100% priority appointments completed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Per care plan",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "0e9c0543-c215-4280-8335-7e5293fe382a",
        "kind": "internal-task",
        "title": "Referral coordination"
      },
      {
        "id": "26255521-7838-4584-8c9d-664e9dabbc35",
        "kind": "measure-vital",
        "title": "Appointment tracking"
      },
      {
        "id": "9214ffdd-346c-49d0-88a5-95c0663c45b2",
        "kind": "barrier",
        "title": "Follow-up access issue"
      },
      {
        "id": "4b118246-96da-4aab-869b-d9fe4f532d2f",
        "kind": "barrier",
        "title": "Referral completion barrier"
      },
      {
        "id": "9d32b242-64b4-4907-8c9e-d5f427d04116",
        "kind": "barrier",
        "title": "Scheduling barrier"
      }
    ]
  },
  {
    "id": "00142cba-38b2-4204-837d-a444be70a121",
    "title": "Close referral loop",
    "description": "Ensure referred services are completed and results are communicated back to the care team.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Care coordination"
    ],
    "comparator": "=",
    "target_value": "100% priority referrals closed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "05edbec6-cadc-4fe7-8bed-138aacb14ae7",
        "kind": "internal-task",
        "title": "Referral coordination"
      },
      {
        "id": "1783f5a5-0a66-448f-8988-6f238b4f01bb",
        "kind": "measure-vital",
        "title": "Referral-closure tracking"
      },
      {
        "id": "05e4a823-a788-4c3d-8eb9-c97d29dd3065",
        "kind": "barrier",
        "title": "Referral completion barrier"
      },
      {
        "id": "e0790f93-febb-40fd-8e35-b5cdc2236a49",
        "kind": "barrier",
        "title": "Care-team coordination gap"
      },
      {
        "id": "3993c9c4-932b-40d9-8ffe-7bbf826bf323",
        "kind": "barrier",
        "title": "Scheduling barrier"
      }
    ]
  },
  {
    "id": "41977110-e692-406f-8848-bac3a611c492",
    "title": "Maintain updated care plan",
    "description": "Keep the patient's care plan current as needs change.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Care coordination"
    ],
    "comparator": "=",
    "target_value": "Reviewed monthly and after significant change",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "ffa69ae0-8ea8-4b00-8aa9-e48627732107",
        "kind": "internal-task",
        "title": "Care-plan review"
      },
      {
        "id": "090a2021-328b-4077-8f6e-ffa653dbfb0c",
        "kind": "internal-task",
        "title": "Care-plan update"
      },
      {
        "id": "94a941ac-b716-44b3-85f3-db1bcd0cbf6b",
        "kind": "barrier",
        "title": "Care-team coordination gap"
      },
      {
        "id": "bfa4761c-5d28-48be-82e1-e0aa63d2d580",
        "kind": "barrier",
        "title": "Changing clinical needs"
      }
    ]
  },
  {
    "id": "b046fffc-0764-4575-8b38-aa058cd6df18",
    "title": "Improve access to primary care",
    "description": "Complete recommended primary-care visits.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Care access"
    ],
    "comparator": "=",
    "target_value": "100% scheduled priority visits completed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Per care plan",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "23dc30e8-b8f7-422e-83fb-5ccff9b35cfe",
        "kind": "measure-vital",
        "title": "Appointment tracking"
      },
      {
        "id": "629407e6-9e43-402e-82fc-9a7b9e81f0ec",
        "kind": "internal-task",
        "title": "Primary-care coordination"
      },
      {
        "id": "e6ab8bfa-f788-454c-87ec-118ce09aeacd",
        "kind": "barrier",
        "title": "Follow-up access issue"
      },
      {
        "id": "1e7b3773-69d7-41fd-86ad-35308b091090",
        "kind": "barrier",
        "title": "Scheduling barrier"
      }
    ]
  },
  {
    "id": "c2b5ea04-3f86-46a8-80bf-f5bfafd407e5",
    "title": "Improve access to transportation",
    "description": "Establish reliable transportation for priority healthcare needs.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Social determinant / access"
    ],
    "comparator": "=",
    "target_value": "Transportation arranged for 100% priority visits",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "As needed",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "ebd7c8ce-e538-4c53-8a5d-2dc891781593",
        "kind": "measure-vital",
        "title": "Transportation assessment"
      },
      {
        "id": "899de6a5-19d8-4cdf-8fa0-74648758f5ec",
        "kind": "internal-task",
        "title": "Transportation coordination"
      },
      {
        "id": "4bb5c8a0-0b9e-4efe-8fbe-692d3c3ad380",
        "kind": "barrier",
        "title": "Transportation barrier"
      },
      {
        "id": "6643fa3e-89e4-4df4-8305-1893d2eda3c8",
        "kind": "barrier",
        "title": "Distance to care"
      }
    ]
  },
  {
    "id": "e7476e3e-c4da-4f0f-8c7e-ccece599dced",
    "title": "Improve access to community resources",
    "description": "Connect the patient with identified community resources.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Social determinants of health"
    ],
    "comparator": ">=",
    "target_value": "1",
    "target_value_2": "",
    "custom_unit": "identified need connected to a resource",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "ddcc9220-1650-468b-8e8f-247830e80b8c",
        "kind": "internal-task",
        "title": "Community-resource navigation"
      },
      {
        "id": "5bc028ac-379e-458c-8762-c3cf35056f5d",
        "kind": "internal-task",
        "title": "SDOH follow-up"
      },
      {
        "id": "8eb09e06-0f9f-4af9-8f75-4e2874bbda09",
        "kind": "barrier",
        "title": "Resource-navigation difficulty"
      },
      {
        "id": "925ec7ea-9eea-4bfd-8b45-035d8e58b742",
        "kind": "barrier",
        "title": "Social needs remain unresolved"
      }
    ]
  },
  {
    "id": "7be2670d-c610-4229-8a15-a4d13a1a0bc4",
    "title": "Improve understanding of condition",
    "description": "Demonstrate understanding of the patient's condition and care plan.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Chronic disease"
    ],
    "comparator": "=",
    "target_value": "Teach-back completed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "6e5043fc-4aa5-49ef-868a-9b8d5f074181",
        "kind": "patient-education",
        "title": "Teach-back education"
      },
      {
        "id": "02302783-e71e-476a-863a-8499d08841e9",
        "kind": "patient-education",
        "title": "Self-management education"
      },
      {
        "id": "635a806b-a441-4f3b-86ab-c02b0bfd3e2b",
        "kind": "barrier",
        "title": "Limited health literacy"
      },
      {
        "id": "e38f17a3-c949-4eca-8a93-af7f7bea3049",
        "kind": "barrier",
        "title": "Need for repeated education"
      }
    ]
  },
  {
    "id": "0b4d9b8a-1c15-4e43-85b7-6480e8d0fbe8",
    "title": "Improve recognition of warning signs",
    "description": "Recognize and appropriately respond to individualized warning signs.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Chronic disease"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "teach-back accuracy",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "4463cd3a-c00f-483e-8194-88673cf38412",
        "kind": "patient-education",
        "title": "Warning-sign education"
      },
      {
        "id": "52fc9af1-e3cc-46db-8774-5cd85c22dece",
        "kind": "patient-education",
        "title": "Symptom escalation education"
      },
      {
        "id": "8983a61c-d9de-43c8-8533-b4292df1223b",
        "kind": "barrier",
        "title": "Limited health literacy"
      },
      {
        "id": "59c1441c-cd56-4215-8128-1aba0d3973ec",
        "kind": "barrier",
        "title": "Cognitive impairment"
      }
    ]
  },
  {
    "id": "b1019a1b-ca1e-4ed0-8e82-1cc463ff407c",
    "title": "Increase patient participation in care decisions",
    "description": "Participate in agreed care-plan decisions and goal setting.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Shared care planning"
    ],
    "comparator": "=",
    "target_value": "Goal reviewed at each care-plan review",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "cbd9ceec-dae8-4301-8ffa-5646466d5ff8",
        "kind": "internal-task",
        "title": "Care-plan review"
      },
      {
        "id": "094e76ce-0275-45d6-8340-99215b18bbe5",
        "kind": "internal-task",
        "title": "Shared goal setting"
      },
      {
        "id": "72e54455-8b79-460a-8fa2-15662338e5d3",
        "kind": "barrier",
        "title": "Low confidence with self-management"
      },
      {
        "id": "cfe90906-f87f-4c79-867f-b7276455d30c",
        "kind": "barrier",
        "title": "Preference mismatch"
      }
    ]
  },
  {
    "id": "b840c54d-f087-42df-8eb7-ab9ac985a1cc",
    "title": "Improve self-monitoring skills",
    "description": "Independently perform the patient's agreed self-monitoring tasks.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Chronic disease"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "scheduled monitoring completed",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Daily",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "a4744f43-bd06-4c86-8003-1148cd1fa1f9",
        "kind": "measure-vital",
        "title": "Self-monitoring log"
      },
      {
        "id": "dc2e9912-76fa-4cf9-8c8e-480118f7f575",
        "kind": "patient-education",
        "title": "Self-management education"
      },
      {
        "id": "2cadd7a0-846f-469f-8149-61f75f43816d",
        "kind": "barrier",
        "title": "Inconsistent self-monitoring"
      },
      {
        "id": "b4f3febc-bc78-4d7a-8ed1-b156967878b9",
        "kind": "barrier",
        "title": "Difficulty using monitoring equipment"
      },
      {
        "id": "8934d1d8-cc30-4888-8a84-0014b1529d81",
        "kind": "barrier",
        "title": "Difficulty learning equipment technique"
      }
    ]
  },
  {
    "id": "d95cafdd-79cb-441f-87bd-c169847d96e1",
    "title": "Improve sleep consistency",
    "description": "Establish a consistent sleep routine.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Sleep difficulty"
    ],
    "comparator": "=",
    "target_value": "Sleep/wake schedule maintained >= 5 days/week",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "8",
    "duration_unit": "Week",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "e2e9dee9-1d35-4bcd-8ed8-b507fd446f6e",
        "kind": "patient-education",
        "title": "Sleep-hygiene education"
      },
      {
        "id": "26a23fa9-39c8-43af-8d1b-510cb94b7a3a",
        "kind": "measure-vital",
        "title": "Sleep routine tracking"
      },
      {
        "id": "6abf9f20-e025-48d4-8ac9-76d033c7180b",
        "kind": "barrier",
        "title": "Irregular sleep schedule"
      },
      {
        "id": "133bc0c9-5edc-4f40-8ef8-3d4a3988c75f",
        "kind": "barrier",
        "title": "Sleep environment barrier"
      }
    ]
  },
  {
    "id": "847ed5b1-5d44-4143-8f7a-456588303538",
    "title": "Improve daytime energy",
    "description": "Improve daytime energy and ability to complete planned activities.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Fatigue"
    ],
    "comparator": "=",
    "target_value": "Increase activity tolerance by 20%",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Week",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "0386948c-626e-4ebd-88a7-32ad9fd24cac",
        "kind": "internal-task",
        "title": "Activity plan"
      },
      {
        "id": "8da37e24-4d20-48ef-8d31-42708a0af7b6",
        "kind": "patient-education",
        "title": "Sleep-hygiene education"
      },
      {
        "id": "a5028334-47e7-4681-8a32-f44ae3341d4e",
        "kind": "internal-task",
        "title": "Energy/activity pacing"
      },
      {
        "id": "b1b85288-a6d9-4510-824c-e7189cb1d3f5",
        "kind": "barrier",
        "title": "Limited physical activity"
      },
      {
        "id": "d63e57b8-b3c5-4328-820b-d6337cafbcf5",
        "kind": "barrier",
        "title": "Fatigue"
      }
    ]
  },
  {
    "id": "814ae06a-00bb-4ee3-897e-e4e4b8680bd1",
    "title": "Address food insecurity",
    "description": "Establish reliable access to adequate food.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Social determinant of health"
    ],
    "comparator": "=",
    "target_value": "Food resource connection established",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "bb3b7601-8e41-4886-8149-d0480b43e77c",
        "kind": "internal-task",
        "title": "Community-resource navigation"
      },
      {
        "id": "778a3116-d321-4699-87f7-f2b3e3ba2fa0",
        "kind": "internal-task",
        "title": "Food-resource coordination"
      },
      {
        "id": "6f2e7667-a806-4680-86b1-8c22bd292926",
        "kind": "barrier",
        "title": "Resource-navigation difficulty"
      },
      {
        "id": "c52a201a-4967-46c5-8d14-18b182fa2d19",
        "kind": "barrier",
        "title": "Food insecurity"
      }
    ]
  },
  {
    "id": "e52df84a-0530-437d-8894-8fa558fcf9af",
    "title": "Address housing instability",
    "description": "Connect the patient with housing-support resources when a need is identified.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Social determinant of health"
    ],
    "comparator": "=",
    "target_value": "Housing resource referral completed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "579a8e31-21c9-4a98-8d24-81e6a6979467",
        "kind": "internal-task",
        "title": "Community-resource navigation"
      },
      {
        "id": "3fec993a-a301-431b-8fcd-3ca0c7ffc5cb",
        "kind": "internal-task",
        "title": "Housing-resource coordination"
      },
      {
        "id": "7f94ca60-3509-482f-8749-d38471f504fa",
        "kind": "barrier",
        "title": "Resource-navigation difficulty"
      },
      {
        "id": "6bb1c348-6692-45c2-8117-94e43d387f70",
        "kind": "barrier",
        "title": "Housing instability"
      }
    ]
  },
  {
    "id": "b521e95d-2ac4-48b1-8065-4e0727c097c5",
    "title": "Improve caregiver support",
    "description": "Establish adequate caregiver support for identified care needs.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Caregiver need"
    ],
    "comparator": "=",
    "target_value": "Priority caregiver needs addressed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "2a7e41bc-122f-45c7-83f9-5b5d849d410a",
        "kind": "measure-vital",
        "title": "Caregiver-needs assessment"
      },
      {
        "id": "c9cbf2f7-0669-4066-89d4-784c3a7470db",
        "kind": "internal-task",
        "title": "Caregiver-resource coordination"
      },
      {
        "id": "db4bc44c-b7c8-4f2b-8f90-ab052340d5d0",
        "kind": "barrier",
        "title": "Caregiver capacity limitation"
      },
      {
        "id": "8c58c376-6233-4a84-8699-32df778adb63",
        "kind": "barrier",
        "title": "Caregiver burden"
      }
    ]
  },
  {
    "id": "30ba13fd-8aeb-4695-8db2-bded705ebf5a",
    "title": "Reduce social isolation",
    "description": "Increase meaningful connection with family, friends, or community supports.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Social isolation"
    ],
    "comparator": ">=",
    "target_value": "2",
    "target_value_2": "",
    "custom_unit": "meaningful contacts/week",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Week",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "1232ce13-48ea-47f8-8200-cc7c881d63aa",
        "kind": "patient-education",
        "title": "Social-connection planning"
      },
      {
        "id": "599b0083-59fc-40f4-8500-e70ba3599dcd",
        "kind": "internal-task",
        "title": "Community-engagement referral"
      },
      {
        "id": "97d288e8-673a-4e60-86b2-db7f2d4faaa0",
        "kind": "internal-task",
        "title": "Social-support follow-up"
      },
      {
        "id": "06fafef3-af74-4411-8321-2a6df56ad3f4",
        "kind": "barrier",
        "title": "Limited social network"
      },
      {
        "id": "121fb8a4-33e3-4a49-8463-64de641981a7",
        "kind": "barrier",
        "title": "Social isolation"
      },
      {
        "id": "20769e0b-2511-4b2d-86da-62dede9386d2",
        "kind": "barrier",
        "title": "Limited community engagement"
      }
    ]
  },
  {
    "id": "2c55bc49-3692-4fe9-8ab5-9bdf01944164",
    "title": "Maintain home safety",
    "description": "Address identified home safety risks.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Safety risk"
    ],
    "comparator": "=",
    "target_value": "100% high-priority hazards addressed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Quarterly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "feb38f77-c8e9-4072-808d-810c580ed258",
        "kind": "patient-education",
        "title": "Home safety education"
      },
      {
        "id": "f2f00ed5-43d3-4d85-8a02-f7f14707195c",
        "kind": "internal-task",
        "title": "Home-safety follow-up"
      },
      {
        "id": "9f1050a2-f1a3-4f01-8782-d4d3a4526f52",
        "kind": "barrier",
        "title": "Fall-risk environment"
      },
      {
        "id": "ff80d33f-5eab-437a-8f91-0f32be1bf7ad",
        "kind": "barrier",
        "title": "Home modification barrier"
      }
    ]
  },
  {
    "id": "824567ff-8cbc-466b-8972-87e7808f332b",
    "title": "Maintain timely care-plan outreach",
    "description": "Complete scheduled care-management contacts.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Care management"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "scheduled contacts completed",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "24dc965e-11bc-423a-8b16-bd692a6a3f51",
        "kind": "internal-task",
        "title": "Care-management outreach"
      },
      {
        "id": "a10b8a73-1bc7-4609-8abc-dc6f41b1bb4e",
        "kind": "internal-task",
        "title": "Proactive care-management review"
      },
      {
        "id": "e6544a8d-bd15-4d18-88f0-e7bcb3994b45",
        "kind": "barrier",
        "title": "Follow-up access issue"
      },
      {
        "id": "5bdc7745-ea62-49a3-87f3-d3106a9059bf",
        "kind": "barrier",
        "title": "Care-management engagement barrier"
      }
    ]
  },
  {
    "id": "2e919291-481c-43e5-8d6b-a574ae7ce8b3",
    "title": "Improve response to care-team outreach",
    "description": "Respond to priority care-team outreach in the agreed timeframe.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Care coordination"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "priority outreach acknowledged within 2 business days",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "As needed",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "77dfdae1-fe96-4348-88ef-234f51390dd2",
        "kind": "internal-task",
        "title": "Care-management outreach"
      },
      {
        "id": "cf7ebb9e-9bbb-4cf0-83a5-ce66e88153a1",
        "kind": "internal-task",
        "title": "Outreach response support"
      },
      {
        "id": "eed1f185-cdba-4d22-8750-07f5aef23278",
        "kind": "barrier",
        "title": "Organizational difficulty"
      },
      {
        "id": "fd643042-3f72-476c-8be7-af783ebbd1a4",
        "kind": "barrier",
        "title": "Care-management engagement barrier"
      }
    ]
  },
  {
    "id": "3108d0f4-efd9-4afe-8dad-56d78583a097",
    "title": "Maintain updated emergency contacts",
    "description": "Keep emergency and caregiver contact information current.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Care coordination"
    ],
    "comparator": "=",
    "target_value": "100% required contacts current",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Month",
    "frequency": "Quarterly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "3aa81c3e-591d-489e-82a2-40dfdef7e6ef",
        "kind": "internal-task",
        "title": "Emergency-contact review"
      },
      {
        "id": "03fb004b-0f3f-439b-8a2f-f6cee0fdd982",
        "kind": "send-form",
        "title": "Patient-information review"
      },
      {
        "id": "a1272706-710a-43cb-8acc-e85f98bc9719",
        "kind": "barrier",
        "title": "Contact-information gap"
      },
      {
        "id": "eed4ad54-1266-41ae-80a6-92c1bf7823ff",
        "kind": "barrier",
        "title": "Outdated patient information"
      }
    ]
  },
  {
    "id": "2ffabbd8-fd6b-47ab-8733-72c35237b38d",
    "title": "Improve engagement with care program",
    "description": "Participate consistently in the care-management program.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Care management"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "planned engagements completed",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "6d61bc34-3ef9-48b1-8eb8-164621dfdc12",
        "kind": "internal-task",
        "title": "Care-management outreach"
      },
      {
        "id": "fdc2e9a9-40cd-496b-8f4c-ca8ac382fc63",
        "kind": "patient-education",
        "title": "Action-plan tracking"
      },
      {
        "id": "2b49b9c4-a43b-4b5d-874d-d51431a254f0",
        "kind": "barrier",
        "title": "Care-management engagement barrier"
      },
      {
        "id": "a6dd135a-efc1-4f8a-8fbd-7c6ce7a17606",
        "kind": "barrier",
        "title": "Competing priorities"
      }
    ]
  },
  {
    "id": "816c5a17-bd70-4ddd-8c26-dca8795b7e9a",
    "title": "Complete individualized care-plan actions",
    "description": "Complete agreed patient-owned care-plan actions.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Care management"
    ],
    "comparator": ">=",
    "target_value": "80%",
    "target_value_2": "",
    "custom_unit": "actions completed",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "Weekly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "5f55ade9-3245-4434-8255-126b12092b4f",
        "kind": "internal-task",
        "title": "Shared goal setting"
      },
      {
        "id": "fa261ddc-63e8-49d7-871d-f8b5c8dad55a",
        "kind": "patient-education",
        "title": "Action-plan tracking"
      },
      {
        "id": "70fd7669-8ff1-4510-8ef5-ce61cad276e5",
        "kind": "barrier",
        "title": "Low confidence with self-management"
      },
      {
        "id": "56b4bbe1-a4b3-457a-8977-017da39c2ce2",
        "kind": "barrier",
        "title": "Competing priorities"
      },
      {
        "id": "4ac7e221-9a66-4c08-8b83-234845285296",
        "kind": "barrier",
        "title": "Multiple active goals"
      }
    ]
  },
  {
    "id": "b847663e-0d16-4b48-8c89-aa44b29ebe8a",
    "title": "Reduce avoidable urgent-care utilization",
    "description": "Reduce avoidable urgent-care or emergency utilization through proactive management.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Chronic disease"
    ],
    "comparator": "=",
    "target_value": "Decrease avoidable visits by 20%",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "19ddc270-1d45-466b-8797-45573d33d9fe",
        "kind": "internal-task",
        "title": "Exacerbation prevention"
      },
      {
        "id": "7eb8b974-3c9e-4cee-82bf-2db1da35d4b3",
        "kind": "patient-education",
        "title": "Symptom escalation education"
      },
      {
        "id": "0ad64d63-9b82-47f8-8d3c-5cac3d5dff91",
        "kind": "internal-task",
        "title": "Proactive care-management review"
      },
      {
        "id": "51fe67a5-3957-4eef-8eca-34a26242227c",
        "kind": "barrier",
        "title": "Unresolved post-discharge needs"
      },
      {
        "id": "b8965017-6062-4351-8006-e4bf1a6c4d63",
        "kind": "barrier",
        "title": "Difficulty recognizing symptom changes"
      },
      {
        "id": "9633d625-38b4-44b2-8ebc-14379df4ce97",
        "kind": "barrier",
        "title": "Frequent acute needs"
      }
    ]
  },
  {
    "id": "88d4cc29-999f-49bd-8116-36eb6a64703a",
    "title": "Improve care-plan goal attainment",
    "description": "Increase completion of active care-plan goals.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Care management"
    ],
    "comparator": ">=",
    "target_value": "80%",
    "target_value_2": "",
    "custom_unit": "active goals on track",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "a8a6add1-0710-4afc-823e-acf19599aeeb",
        "kind": "internal-task",
        "title": "Care-plan review"
      },
      {
        "id": "ebd3353a-a830-42ed-84ab-a7b5db1a1e4c",
        "kind": "patient-education",
        "title": "Action-plan tracking"
      },
      {
        "id": "03005cb4-9d38-4d13-8007-a0cc5e2598d1",
        "kind": "internal-task",
        "title": "Goal-progress review"
      },
      {
        "id": "848c2913-2f8e-4e07-8683-70c936498518",
        "kind": "barrier",
        "title": "Changing clinical needs"
      },
      {
        "id": "eee431a3-2095-4976-8044-d801a6325e25",
        "kind": "barrier",
        "title": "Multiple active goals"
      }
    ]
  },
  {
    "id": "23de8dfe-6279-4936-8382-a6a7b78aa370",
    "title": "Maintain stable chronic-condition status",
    "description": "Maintain chronic conditions at or near the patient's established baseline.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Multiple chronic conditions"
    ],
    "comparator": "=",
    "target_value": "No clinically significant deterioration from baseline",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "a6ba1d83-e3d4-4d40-8d75-f9ed59fdedc0",
        "kind": "patient-education",
        "title": "Symptom escalation education"
      },
      {
        "id": "112f677a-e030-464f-8cb1-06d19f0b9a17",
        "kind": "internal-task",
        "title": "Proactive care-management review"
      },
      {
        "id": "bb202d7a-d79c-453d-8b3d-c1eaa491fdf6",
        "kind": "internal-task",
        "title": "Goal-progress review"
      },
      {
        "id": "00b3516f-8fd0-4cdb-837e-ea7441dcf43c",
        "kind": "barrier",
        "title": "Difficulty recognizing symptom changes"
      },
      {
        "id": "d0fa4226-feed-489a-8c4d-2335c9e71586",
        "kind": "barrier",
        "title": "Delayed symptom reporting"
      },
      {
        "id": "adef768c-f16a-483b-86b2-9c22b0bfe33b",
        "kind": "barrier",
        "title": "Frequent acute needs"
      }
    ]
  },
  {
    "id": "772a24ff-eea0-42b9-8966-daeced90e6f7",
    "title": "Improve timely reporting of symptoms",
    "description": "Report significant symptom changes to the care team promptly.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Chronic disease"
    ],
    "comparator": "=",
    "target_value": "100% significant changes reported within agreed timeframe",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "3",
    "duration_unit": "Month",
    "frequency": "As needed",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "e9aaab74-4ca8-407c-8fd8-fd96ed6bfa6c",
        "kind": "patient-education",
        "title": "Symptom escalation education"
      },
      {
        "id": "39051271-8af8-441f-8291-9d1650b4e83f",
        "kind": "internal-task",
        "title": "Outreach response support"
      },
      {
        "id": "6b8ef279-aa49-44e3-8d13-275ce0b2761d",
        "kind": "barrier",
        "title": "Difficulty recognizing symptom changes"
      },
      {
        "id": "89a0bb23-f0c1-44e4-8110-7822dfb75796",
        "kind": "barrier",
        "title": "Delayed symptom reporting"
      }
    ]
  },
  {
    "id": "351558d3-1fd7-4573-8f64-2c9714fc234d",
    "title": "Reduce missed appointments",
    "description": "Improve attendance at priority healthcare appointments.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Care access"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "attendance",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "371960ec-981e-43f4-88c2-790bd47512d9",
        "kind": "measure-vital",
        "title": "Appointment tracking"
      },
      {
        "id": "cfb2f65f-2685-482e-85d4-6873ee2d84ff",
        "kind": "internal-task",
        "title": "Appointment reminders"
      },
      {
        "id": "87378341-b25d-4866-8582-a6801a6703be",
        "kind": "barrier",
        "title": "Follow-up access issue"
      },
      {
        "id": "bfb47014-a29c-499e-8410-2c2bc9d42b36",
        "kind": "barrier",
        "title": "Transportation barrier"
      },
      {
        "id": "9fb2ad7b-2c5c-4032-898a-8f0cb129bc67",
        "kind": "barrier",
        "title": "Missed appointment pattern"
      }
    ]
  },
  {
    "id": "e092b7df-4d1c-4265-8aa5-4a91cecf38f9",
    "title": "Improve continuity after provider transition",
    "description": "Maintain continuity of care after a provider or facility transition.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Care transition"
    ],
    "comparator": "=",
    "target_value": "New care relationship established within 30 days",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "30",
    "duration_unit": "Day",
    "frequency": "Per transition",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "dd99a1bf-6fce-4056-87e4-52ab0bb34677",
        "kind": "internal-task",
        "title": "Post-discharge outreach"
      },
      {
        "id": "a9cdf6ee-5a7f-45b0-8b8d-f5f0a1bcee40",
        "kind": "internal-task",
        "title": "Care-team handoff"
      },
      {
        "id": "fafcbf20-f5b3-44e1-8e14-cef1ec2d1f1c",
        "kind": "internal-task",
        "title": "Provider-transition coordination"
      },
      {
        "id": "aff22e7f-7f86-4218-8bf8-dc18caf7ecde",
        "kind": "barrier",
        "title": "Follow-up access issue"
      },
      {
        "id": "2ad5f21a-dbfd-42cf-8469-fb955afd82e8",
        "kind": "barrier",
        "title": "Care-team coordination gap"
      },
      {
        "id": "89939ded-8b80-46fc-8ee7-3742d49b2ae7",
        "kind": "barrier",
        "title": "Provider/facility transition"
      }
    ]
  },
  {
    "id": "2253e5c7-0d0f-42b0-8a54-d2362135c45a",
    "title": "Maintain accurate patient health information",
    "description": "Keep key clinical, medication, contact, and care-team information current.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Care coordination"
    ],
    "comparator": "=",
    "target_value": "100% required fields reviewed",
    "target_value_2": "",
    "custom_unit": "",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Month",
    "frequency": "Quarterly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "91bb10fa-114c-4d34-8e3b-bf691915c0df",
        "kind": "internal-task",
        "title": "Medication reconciliation"
      },
      {
        "id": "af87b796-a028-4e5d-812c-39d1fe53e074",
        "kind": "internal-task",
        "title": "Care-plan review"
      },
      {
        "id": "3c6ac3ab-84ff-4436-80d9-ee223733e508",
        "kind": "send-form",
        "title": "Patient-information review"
      },
      {
        "id": "e18a3f47-e03a-46ef-89a0-3e41e74f9337",
        "kind": "barrier",
        "title": "Medication list discrepancy"
      },
      {
        "id": "e884da9e-62fe-4068-8852-6d9ddb3e03f2",
        "kind": "barrier",
        "title": "Outdated patient information"
      },
      {
        "id": "cc4a2c50-a401-421b-8fd5-5ea1998dbf90",
        "kind": "barrier",
        "title": "Fragmented health information"
      }
    ]
  },
  {
    "id": "0ebef36f-8fb6-4ee7-87b0-a514d63a09d4",
    "title": "Improve completion of recommended labs",
    "description": "Complete recommended laboratory monitoring on schedule.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Chronic disease monitoring"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "scheduled labs completed",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Per care plan",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "f500f956-e4cc-4e0d-8bb0-c17518eef9e0",
        "kind": "measure-vital",
        "title": "Lab tracking"
      },
      {
        "id": "3ec271de-1960-41f7-8de1-11df49f11683",
        "kind": "measure-vital",
        "title": "Appointment tracking"
      },
      {
        "id": "ada11434-e543-415e-8909-0d8c98c16039",
        "kind": "internal-task",
        "title": "Lab completion follow-up"
      },
      {
        "id": "d8fb8778-30dc-4565-8dfe-fb466a8f07e8",
        "kind": "barrier",
        "title": "Appointment access issue"
      },
      {
        "id": "019c8098-7820-4371-820e-13516cfdf3e1",
        "kind": "barrier",
        "title": "Lab access issue"
      },
      {
        "id": "fc669fee-da97-466b-8f39-de619b6aedf1",
        "kind": "barrier",
        "title": "Scheduling barrier"
      }
    ]
  },
  {
    "id": "ae068eb6-1396-4b51-8566-3811aaa85901",
    "title": "Improve completion of recommended preventive services",
    "description": "Address all recommended preventive services that are due.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Preventive care"
    ],
    "comparator": ">=",
    "target_value": "90%",
    "target_value_2": "",
    "custom_unit": "due services completed or appropriately addressed",
    "set_target": true,
    "duration": "12",
    "duration_unit": "Month",
    "frequency": "Quarterly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "e41753fb-f0ff-4d24-8e69-5be8e774cb5b",
        "kind": "internal-task",
        "title": "AWV coordination"
      },
      {
        "id": "ad1e7fe4-9e8a-4cfe-8be3-a45a409f8362",
        "kind": "measure-vital",
        "title": "Preventive screening tracking"
      },
      {
        "id": "4e81c991-83f4-45d2-86e4-aa429f9969d8",
        "kind": "internal-task",
        "title": "Immunization review"
      },
      {
        "id": "b0a13bb0-7e4e-4709-8a72-07c192bff877",
        "kind": "barrier",
        "title": "Appointment access issue"
      },
      {
        "id": "939b971c-fdc1-42ce-8ce4-c52844747ed4",
        "kind": "barrier",
        "title": "Referral completion barrier"
      },
      {
        "id": "c7bc6732-7f56-441e-84bf-bc21b7abf3cf",
        "kind": "barrier",
        "title": "Immunization access barrier"
      }
    ]
  },
  {
    "id": "c917d9c1-eb61-4f83-8c0d-91088319d23b",
    "title": "Maintain overall care-plan stability",
    "description": "Maintain the patient's key clinical, functional, and care-coordination goals on track.",
    "category": "Other",
    "measure": "",
    "conditions": [
      "Comprehensive care management"
    ],
    "comparator": ">=",
    "target_value": "80%",
    "target_value_2": "",
    "custom_unit": "active goals on track",
    "set_target": true,
    "duration": "6",
    "duration_unit": "Month",
    "frequency": "Monthly",
    "target_date": "",
    "priority": "medium",
    "links": [
      {
        "id": "a0e5aec7-dc8c-405d-876f-645662026fc9",
        "kind": "internal-task",
        "title": "Care-plan review"
      },
      {
        "id": "e524ec2f-9fb7-4c45-8414-2d0c994ca30c",
        "kind": "internal-task",
        "title": "Proactive care-management review"
      },
      {
        "id": "e07ecb86-d5bc-49a8-8121-c3460ffe35b0",
        "kind": "internal-task",
        "title": "Goal-progress review"
      },
      {
        "id": "1770756a-8a3f-4c93-8476-f2c620b4cc8d",
        "kind": "barrier",
        "title": "Changing clinical needs"
      },
      {
        "id": "08edc2ca-4be8-412e-81b9-6e8ec1ad10ed",
        "kind": "barrier",
        "title": "Multiple active goals"
      },
      {
        "id": "f00cc865-efc5-4bd1-881e-20b9f9ec0fae",
        "kind": "barrier",
        "title": "Frequent acute needs"
      }
    ]
  }
];

// The seed authored every goal as "Other"; derive the real category from the
// goal's title + description against the five library types the Create Goal
// drawer offers (Vital / Activity / Lab result / Assessment / Other). Domain
// keywords (a measured vital, a lab, an activity) win over the generic
// "education/review" bucket, so "Maintain blood pressure" → Vital while
// "Hypertension education" → Assessment. Heuristic and easy to override per
// goal in the Edit Goal drawer.
const GOAL_CATEGORY_RULES = [
  ['Lab result', /\b(a1c|hba1c|ldl|hdl|cholesterol|lipid|triglyceride|kidney|renal|egfr|creatinine|urine|microalbumin|labs?)\b/i],
  ['Vital', /\b(blood pressure|heart[ -]?rate|resting heart|pulse|spo2|oxygen satur|daily weight|weight monitoring|weight for|body weight|glucose|glycemic|hypoglycem|hyperglycem|temperature|respiratory rate|vital sign)\b/i],
  ['Activity', /\b(activity|exercise|walk|physical activit|steps|strength|aerobic|mobility|balance)\b/i],
  ['Assessment', /\b(education|counsel|screening|screen for|assessment|assess |review|teach|wellness visit|preventive|immuniz|vaccin|depression screen|phq|gad|action plan)\b/i],
];

export function goalLibraryCategory(g) {
  // Title only — descriptions list adjacent services ("...labs, therapy...")
  // that would misclassify a coordination goal as a lab goal.
  const hay = g.title || '';
  for (const [cat, re] of GOAL_CATEGORY_RULES) if (re.test(hay)) return cat;
  return 'Other';
}

// care_plan_goals row (drops the embedded links; derives the category; stamps
// the library author so the goals list can show who created each goal).
export function carePlanGoalLibraryToRow(g) {
  const { links, ...row } = g;
  return { ...row, category: goalLibraryCategory(g), created_by: g.created_by || 'Fold Health' };
}

// Per-goal care_plan_interventions rows (a goal's linked interventions +
// barriers, kind === 'barrier' for the latter).
export function carePlanGoalLibraryLinkRows(g) {
  return (g.links || []).map((l) => ({ id: l.id, goal_id: g.id, kind: l.kind, title: l.title, config: {} }));
}
