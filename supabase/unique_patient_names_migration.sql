-- Unique patient names: generated (see scratchpad gen-unique-names.mjs)
-- Every duplicate (same name, different member_id) gets a fresh unique
-- name; the canonical member_id (prefer the one with a patients row)
-- keeps the original. Applied consistently across all patient tables;
-- all_patients emails follow the new first name; SNP rows whose
-- patient_id was name-linked to a now-renamed identity are self-linked.
BEGIN;

-- James Rivera [10015] -> Kavya Bose
UPDATE public.snp_worklist_members SET name = 'Kavya Bose', initials = 'KB' WHERE member_id = '10015' AND name = 'James Rivera';

-- Maria Lopez [10018] -> Dev Chawla
UPDATE public.snp_worklist_members SET name = 'Dev Chawla', initials = 'DC' WHERE member_id = '10018' AND name = 'Maria Lopez';

-- Elena Garcia [10020] -> Nisha Iyer
UPDATE public.snp_worklist_members SET name = 'Nisha Iyer', initials = 'NI' WHERE member_id = '10020' AND name = 'Elena Garcia';

-- Annette Brave [11117] -> Aditya Menon
UPDATE public.hcc_members SET name = 'Aditya Menon', initials = 'AM' WHERE member_id = '11117' AND name = 'Annette Brave';

-- Annette Brave [11033] -> Tara Rao
UPDATE public.hcc_members SET name = 'Tara Rao', initials = 'TR' WHERE member_id = '11033' AND name = 'Annette Brave';

-- Annette Brave [10045] -> Ishaan Saxena
UPDATE public.ccm_worklist_members SET name = 'Ishaan Saxena', initials = 'IS' WHERE member_id = '10045' AND name = 'Annette Brave';

-- Ralph Halvorson [10003] -> Rehan Ellery
UPDATE public.snp_worklist_members SET name = 'Rehan Ellery', initials = 'RE' WHERE member_id = '10003' AND name = 'Ralph Halvorson';

-- Annette Brave [10039] -> Kabir Joshi
UPDATE public.snp_worklist_members SET name = 'Kabir Joshi', initials = 'KJ' WHERE member_id = '10039' AND name = 'Annette Brave';

-- Helen Jackson [10032] -> Sana Malhotra
UPDATE public.snp_worklist_members SET name = 'Sana Malhotra', initials = 'SM' WHERE member_id = '10032' AND name = 'Helen Jackson';

-- Helen Jackson [11170] -> Vivaan Sethi
UPDATE public.all_patients SET name = 'Vivaan Sethi', initials = 'VS' WHERE member_id = '11170' AND name = 'Helen Jackson';
UPDATE public.all_patients SET email = 'vivaan@fold.health' WHERE id = 'ap-016';

-- Diana Welch [10014] -> Riya Trivedi
UPDATE public.snp_worklist_members SET name = 'Riya Trivedi', initials = 'RT' WHERE member_id = '10014' AND name = 'Diana Welch';

-- Lisa Brown [10026] -> Aryan Ashford
UPDATE public.snp_worklist_members SET name = 'Aryan Ashford', initials = 'AA' WHERE member_id = '10026' AND name = 'Lisa Brown';

-- Lisa Brown [10975] -> Pooja Bellamy
UPDATE public.all_patients SET name = 'Pooja Bellamy', initials = 'PB' WHERE member_id = '10975' AND name = 'Lisa Brown';
UPDATE public.all_patients SET email = 'pooja@fold.health' WHERE id = 'ap-017';

-- William Davis [11090] -> Nikhil Crowley
UPDATE public.awv_members SET name = 'Nikhil Crowley', initials = 'NC' WHERE member_id = '11090' AND name = 'William Davis';

-- William Davis [10029] -> Divya Dunmore
UPDATE public.snp_worklist_members SET name = 'Divya Dunmore', initials = 'DD' WHERE member_id = '10029' AND name = 'William Davis';

-- Priya Sharma [11126] -> Anjali Fairbank
UPDATE public.hcc_members SET name = 'Anjali Fairbank', initials = 'AF' WHERE member_id = '11126' AND name = 'Priya Sharma';

-- Priya Sharma [11180] -> Samar Gresham
UPDATE public.all_patients SET name = 'Samar Gresham', initials = 'SG' WHERE member_id = '11180' AND name = 'Priya Sharma';

-- Anaya Gupta [11028] -> Leela Hollis
UPDATE public.all_patients SET name = 'Leela Hollis', initials = 'LH' WHERE member_id = '11028' AND name = 'Anaya Gupta';

-- Anaya Gupta [11074] -> Owen Ingram
UPDATE public.all_patients SET name = 'Owen Ingram', initials = 'OI' WHERE member_id = '11074' AND name = 'Anaya Gupta';

-- Anaya Gupta [11190] -> Clara Joplin
UPDATE public.all_patients SET name = 'Clara Joplin', initials = 'CJ' WHERE member_id = '11190' AND name = 'Anaya Gupta';

-- Mira Patel [11021] -> Felix Kessler
UPDATE public.all_patients SET name = 'Felix Kessler', initials = 'FK' WHERE member_id = '11021' AND name = 'Mira Patel';

-- Mira Patel [11059] -> Nora Lombard
UPDATE public.all_patients SET name = 'Nora Lombard', initials = 'NL' WHERE member_id = '11059' AND name = 'Mira Patel';

-- Karan Kapoor [11166] -> Jasper Merrick
UPDATE public.all_patients SET name = 'Jasper Merrick', initials = 'JM' WHERE member_id = '11166' AND name = 'Karan Kapoor';

-- Karan Kapoor [11189] -> Ivy Norwood
UPDATE public.all_patients SET name = 'Ivy Norwood', initials = 'IN' WHERE member_id = '11189' AND name = 'Karan Kapoor';

-- Aarav Reddy [11114] -> Silas Ostrander
UPDATE public.all_patients SET name = 'Silas Ostrander', initials = 'SO' WHERE member_id = '11114' AND name = 'Aarav Reddy';

-- Aarav Reddy [11176] -> Wren Prescott
UPDATE public.all_patients SET name = 'Wren Prescott', initials = 'WP' WHERE member_id = '11176' AND name = 'Aarav Reddy';

-- Arjun Verma [11057] -> Hugo Quimby
UPDATE public.all_patients SET name = 'Hugo Quimby', initials = 'HQ' WHERE member_id = '11057' AND name = 'Arjun Verma';

-- Arjun Verma [11112] -> Elsie Rutledge
UPDATE public.all_patients SET name = 'Elsie Rutledge', initials = 'ER' WHERE member_id = '11112' AND name = 'Arjun Verma';

-- Rahul Verma [11192] -> Miles Nair
UPDATE public.all_patients SET name = 'Miles Nair', initials = 'MN' WHERE member_id = '11192' AND name = 'Rahul Verma';

-- Priya Verma [11115] -> Freya Bose
UPDATE public.all_patients SET name = 'Freya Bose', initials = 'FB' WHERE member_id = '11115' AND name = 'Priya Verma';

-- Priya Verma [11172] -> Ezra Chawla
UPDATE public.all_patients SET name = 'Ezra Chawla', initials = 'EC' WHERE member_id = '11172' AND name = 'Priya Verma';

-- Aarav Verma [11064] -> Opal Iyer
UPDATE public.all_patients SET name = 'Opal Iyer', initials = 'OI' WHERE member_id = '11064' AND name = 'Aarav Verma';

-- Aarav Verma [11141] -> Rhys Menon
UPDATE public.all_patients SET name = 'Rhys Menon', initials = 'RM' WHERE member_id = '11141' AND name = 'Aarav Verma';

-- Vikram Patel [11003] -> Vera Rao
UPDATE public.all_patients SET name = 'Vera Rao', initials = 'VR' WHERE member_id = '11003' AND name = 'Vikram Patel';

-- Vikram Patel [11023] -> Otis Saxena
UPDATE public.all_patients SET name = 'Otis Saxena', initials = 'OS' WHERE member_id = '11023' AND name = 'Vikram Patel';

-- Isha Sharma [11185] -> June Bhatt
UPDATE public.all_patients SET name = 'June Bhatt', initials = 'JB' WHERE member_id = '11185' AND name = 'Isha Sharma';

-- Karan Sharma [11162] -> Lars Joshi
UPDATE public.all_patients SET name = 'Lars Joshi', initials = 'LJ' WHERE member_id = '11162' AND name = 'Karan Sharma';

-- Neha Kapoor [11062] -> Petra Malhotra
UPDATE public.all_patients SET name = 'Petra Malhotra', initials = 'PM' WHERE member_id = '11062' AND name = 'Neha Kapoor';

-- Arjun Reddy [11073] -> Rohan Sethi
UPDATE public.all_patients SET name = 'Rohan Sethi', initials = 'RS' WHERE member_id = '11073' AND name = 'Arjun Reddy';

-- Arjun Reddy [11132] -> Kavya Trivedi
UPDATE public.all_patients SET name = 'Kavya Trivedi', initials = 'KT' WHERE member_id = '11132' AND name = 'Arjun Reddy';

-- Arjun Reddy [11151] -> Dev Ashford
UPDATE public.all_patients SET name = 'Dev Ashford', initials = 'DA' WHERE member_id = '11151' AND name = 'Arjun Reddy';

-- Isha Verma [11161] -> Nisha Bellamy
UPDATE public.all_patients SET name = 'Nisha Bellamy', initials = 'NB' WHERE member_id = '11161' AND name = 'Isha Verma';

-- Karan Verma [11030] -> Aditya Crowley
UPDATE public.all_patients SET name = 'Aditya Crowley', initials = 'AC' WHERE member_id = '11030' AND name = 'Karan Verma';

-- Mira Reddy [11163] -> Tara Dunmore
UPDATE public.all_patients SET name = 'Tara Dunmore', initials = 'TD' WHERE member_id = '11163' AND name = 'Mira Reddy';

-- Anaya Mehta [11121] -> Ishaan Ellery
UPDATE public.all_patients SET name = 'Ishaan Ellery', initials = 'IE' WHERE member_id = '11121' AND name = 'Anaya Mehta';

-- Mira Singh [11178] -> Meera Fairbank
UPDATE public.all_patients SET name = 'Meera Fairbank', initials = 'MF' WHERE member_id = '11178' AND name = 'Mira Singh';

-- Rahul Singh [11159] -> Kabir Gresham
UPDATE public.all_patients SET name = 'Kabir Gresham', initials = 'KG' WHERE member_id = '11159' AND name = 'Rahul Singh';

-- Anaya Joshi [11181] -> Sana Hollis
UPDATE public.all_patients SET name = 'Sana Hollis', initials = 'SH' WHERE member_id = '11181' AND name = 'Anaya Joshi';

-- Rahul Sharma [11072] -> Vivaan Ingram
UPDATE public.all_patients SET name = 'Vivaan Ingram', initials = 'VI' WHERE member_id = '11072' AND name = 'Rahul Sharma';

-- Arjun Gupta [11036] -> Riya Joplin
UPDATE public.all_patients SET name = 'Riya Joplin', initials = 'RJ' WHERE member_id = '11036' AND name = 'Arjun Gupta';

-- Re-link SNP rows whose name-based patient link now points at a
-- different identity: fall back to self-link so the profile opens
-- against the SNP slice with the row own (new) name.
UPDATE public.snp_worklist_members s
SET    patient_id = s.id
FROM   public.patients p
WHERE  s.patient_id = p.id
AND    p.name <> s.name;

COMMIT;
-- Straggler: snpw-006 carried the same member_id (10003) as snpw-004
-- ("Ralph Halvorson") under a different name: one member_id, two names.
-- The generator keyed renames by member_id, so this row's rename was
-- clobbered by Ralph's. Renamed explicitly; the self-link rule re-applies.
BEGIN;
UPDATE public.snp_worklist_members SET name = 'Meera Chawla', initials = 'MC'
WHERE id = 'snpw-006' AND name = 'Annette Brave';
UPDATE public.snp_worklist_members s
SET    patient_id = s.id
FROM   public.patients p
WHERE  s.patient_id = p.id
AND    p.name <> s.name;
COMMIT;

-- snpw-006 also SHARED snpw-004's member_id (10003): one id, two people.
-- Mint a fresh, globally-unused member id so identity-keyed features
-- (search dedupe, All Patients union, worklist sync) treat them as the
-- distinct patients they are.
BEGIN;
UPDATE public.snp_worklist_members SET member_id = '10048' WHERE id = 'snpw-006';
COMMIT;
