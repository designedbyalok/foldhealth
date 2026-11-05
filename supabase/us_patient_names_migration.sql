-- US patient names: replaces every Indian first/last name with a
-- unique US-typical name (target audience is US; demo data should read
-- accordingly). Applied per member_id across all six patient tables;
-- initials regenerated; all_patients emails follow the new first name;
-- SNP name-links re-checked (self-link when the linked name diverges).
BEGIN;

-- Kevin Singh [11100] -> James Anderson
UPDATE public.patients SET name = 'James Anderson', initials = 'JA' WHERE member_id = '11100' AND name = 'Kevin Singh';

-- Nancy Patel [11135] -> Mary Thompson
UPDATE public.patients SET name = 'Mary Thompson', initials = 'MT' WHERE member_id = '11135' AND name = 'Nancy Patel';

-- Anjali Fairbank [11126] -> Jennifer Martinez
UPDATE public.hcc_members SET name = 'Jennifer Martinez', initials = 'JM' WHERE member_id = '11126' AND name = 'Anjali Fairbank';

-- Aditya Menon [11117] -> Michael Robinson
UPDATE public.hcc_members SET name = 'Michael Robinson', initials = 'MR' WHERE member_id = '11117' AND name = 'Aditya Menon';

-- Tara Rao [11033] -> Linda Clark
UPDATE public.hcc_members SET name = 'Linda Clark', initials = 'LC' WHERE member_id = '11033' AND name = 'Tara Rao';

-- Nikhil Crowley [11090] -> Robert Rodriguez
UPDATE public.awv_members SET name = 'Robert Rodriguez', initials = 'RR' WHERE member_id = '11090' AND name = 'Nikhil Crowley';

-- Ishaan Saxena [10045] -> David Lewis
UPDATE public.ccm_worklist_members SET name = 'David Lewis', initials = 'DL' WHERE member_id = '10045' AND name = 'Ishaan Saxena';

-- Kavya Bose [10015] -> Thomas Walker
UPDATE public.snp_worklist_members SET name = 'Thomas Walker', initials = 'TW' WHERE member_id = '10015' AND name = 'Kavya Bose';

-- Dev Chawla [10018] -> Susan Hall
UPDATE public.snp_worklist_members SET name = 'Susan Hall', initials = 'SH' WHERE member_id = '10018' AND name = 'Dev Chawla';

-- Nisha Iyer [10020] -> Nancy Young
UPDATE public.snp_worklist_members SET name = 'Nancy Young', initials = 'NY' WHERE member_id = '10020' AND name = 'Nisha Iyer';

-- Sana Malhotra [10032] -> Betty King
UPDATE public.snp_worklist_members SET name = 'Betty King', initials = 'BK' WHERE member_id = '10032' AND name = 'Sana Malhotra';

-- Riya Trivedi [10014] -> Sandra Wright
UPDATE public.snp_worklist_members SET name = 'Sandra Wright', initials = 'SW' WHERE member_id = '10014' AND name = 'Riya Trivedi';

-- Aryan Ashford [10026] -> Carol Scott
UPDATE public.snp_worklist_members SET name = 'Carol Scott', initials = 'CS' WHERE member_id = '10026' AND name = 'Aryan Ashford';

-- Rehan Ellery [10003] -> Daniel Torres
UPDATE public.snp_worklist_members SET name = 'Daniel Torres', initials = 'DT' WHERE member_id = '10003' AND name = 'Rehan Ellery';

-- Meera Chawla [10048] -> Michelle Nguyen
UPDATE public.snp_worklist_members SET name = 'Michelle Nguyen', initials = 'MN' WHERE member_id = '10048' AND name = 'Meera Chawla';

-- Priya Tandon [10036] -> Laura Hill
UPDATE public.snp_worklist_members SET name = 'Laura Hill', initials = 'LH' WHERE member_id = '10036' AND name = 'Priya Tandon';

-- Robert Singh [10038] -> Matthew Flores
UPDATE public.snp_worklist_members SET name = 'Matthew Flores', initials = 'MF' WHERE member_id = '10038' AND name = 'Robert Singh';

-- Kabir Joshi [10039] -> Amy Green
UPDATE public.snp_worklist_members SET name = 'Amy Green', initials = 'AG' WHERE member_id = '10039' AND name = 'Kabir Joshi';

-- Divya Dunmore [10029] -> Andrew Adams
UPDATE public.snp_worklist_members SET name = 'Andrew Adams', initials = 'AA' WHERE member_id = '10029' AND name = 'Divya Dunmore';

-- Nina Patel [10969] -> Kathleen Nelson
UPDATE public.all_patients SET name = 'Kathleen Nelson', initials = 'KN' WHERE member_id = '10969' AND name = 'Nina Patel';
UPDATE public.all_patients SET email = 'kathleen@fold.health' WHERE id = 'ap-020';

-- Vikram Gupta [11125] -> Joseph Baker
UPDATE public.all_patients SET name = 'Joseph Baker', initials = 'JB' WHERE member_id = '11125' AND name = 'Vikram Gupta';

-- Mira Patel [10987] -> Angela Rivera
UPDATE public.all_patients SET name = 'Angela Rivera', initials = 'AR' WHERE member_id = '10987' AND name = 'Mira Patel';

-- Diya Kapoor [11155] -> Melissa Campbell
UPDATE public.all_patients SET name = 'Melissa Campbell', initials = 'MC' WHERE member_id = '11155' AND name = 'Diya Kapoor';

-- Arjun Mehta [11007] -> Brian Mitchell
UPDATE public.all_patients SET name = 'Brian Mitchell', initials = 'BM' WHERE member_id = '11007' AND name = 'Arjun Mehta';

-- Karan Singh [11165] -> Kevin Carter
UPDATE public.all_patients SET name = 'Kevin Carter', initials = 'KC' WHERE member_id = '11165' AND name = 'Karan Singh';

-- Vikram Sharma [11029] -> Eric Roberts
UPDATE public.all_patients SET name = 'Eric Roberts', initials = 'ER' WHERE member_id = '11029' AND name = 'Vikram Sharma';

-- Arjun Sharma [10967] -> Scott Gomez
UPDATE public.all_patients SET name = 'Scott Gomez', initials = 'SG' WHERE member_id = '10967' AND name = 'Arjun Sharma';

-- Vikram Joshi [11182] -> Gregory Phillips
UPDATE public.all_patients SET name = 'Gregory Phillips', initials = 'GP' WHERE member_id = '11182' AND name = 'Vikram Joshi';

-- Neha Patel [11012] -> Rebecca Evans
UPDATE public.all_patients SET name = 'Rebecca Evans', initials = 'RE' WHERE member_id = '11012' AND name = 'Neha Patel';

-- Priya Sharma [11025] -> Stephanie Turner
UPDATE public.all_patients SET name = 'Stephanie Turner', initials = 'ST' WHERE member_id = '11025' AND name = 'Priya Sharma';

-- Arjun Kapoor [11131] -> Patrick Diaz
UPDATE public.all_patients SET name = 'Patrick Diaz', initials = 'PD' WHERE member_id = '11131' AND name = 'Arjun Kapoor';

-- Rohan Nair [10959] -> Jeffrey Parker
UPDATE public.all_patients SET name = 'Jeffrey Parker', initials = 'JP' WHERE member_id = '10959' AND name = 'Rohan Nair';

-- Isha Nair [11147] -> Sharon Cruz
UPDATE public.all_patients SET name = 'Sharon Cruz', initials = 'SC' WHERE member_id = '11147' AND name = 'Isha Nair';

-- Vikram Mehta [10991] -> Ryan Edwards
UPDATE public.all_patients SET name = 'Ryan Edwards', initials = 'RE' WHERE member_id = '10991' AND name = 'Vikram Mehta';

-- Karan Patel [11026] -> Nathan Collins
UPDATE public.all_patients SET name = 'Nathan Collins', initials = 'NC' WHERE member_id = '11026' AND name = 'Karan Patel';

-- Anaya Reddy [11183] -> Cynthia Reyes
UPDATE public.all_patients SET name = 'Cynthia Reyes', initials = 'CR' WHERE member_id = '11183' AND name = 'Anaya Reddy';

-- Isha Sharma [11128] -> Rachel Stewart
UPDATE public.all_patients SET name = 'Rachel Stewart', initials = 'RS' WHERE member_id = '11128' AND name = 'Isha Sharma';

-- Vivaan Sethi [11170] -> Janet Morris
UPDATE public.all_patients SET name = 'Janet Morris', initials = 'JM' WHERE member_id = '11170' AND name = 'Vivaan Sethi';
UPDATE public.all_patients SET email = 'janet@fold.health' WHERE id = 'ap-016';

-- Pooja Bellamy [10975] -> Emma Morales
UPDATE public.all_patients SET name = 'Emma Morales', initials = 'EM' WHERE member_id = '10975' AND name = 'Pooja Bellamy';
UPDATE public.all_patients SET email = 'emma@fold.health' WHERE id = 'ap-017';

-- Rohan Patel [11051] -> Tyler Murphy
UPDATE public.all_patients SET name = 'Tyler Murphy', initials = 'TM' WHERE member_id = '11051' AND name = 'Rohan Patel';

-- Vikram Patel [10984] -> Brandon Cook
UPDATE public.all_patients SET name = 'Brandon Cook', initials = 'BC' WHERE member_id = '10984' AND name = 'Vikram Patel';

-- Rahul Joshi [11186] -> Dennis Rogers
UPDATE public.all_patients SET name = 'Dennis Rogers', initials = 'DR' WHERE member_id = '11186' AND name = 'Rahul Joshi';

-- Rohan Singh [10982] -> Craig Peterson
UPDATE public.all_patients SET name = 'Craig Peterson', initials = 'CP' WHERE member_id = '10982' AND name = 'Rohan Singh';

-- Arjun Joshi [11038] -> Wayne Cooper
UPDATE public.all_patients SET name = 'Wayne Cooper', initials = 'WC' WHERE member_id = '11038' AND name = 'Arjun Joshi';

-- Isha Verma [10973] -> Catherine Reed
UPDATE public.all_patients SET name = 'Catherine Reed', initials = 'CR' WHERE member_id = '10973' AND name = 'Isha Verma';

-- Karan Verma [10965] -> Russell Bailey
UPDATE public.all_patients SET name = 'Russell Bailey', initials = 'RB' WHERE member_id = '10965' AND name = 'Karan Verma';

-- Aarav Verma [11002] -> Carl Bell
UPDATE public.all_patients SET name = 'Carl Bell', initials = 'CB' WHERE member_id = '11002' AND name = 'Aarav Verma';

-- Neha Kapoor [10970] -> Heather Howard
UPDATE public.all_patients SET name = 'Heather Howard', initials = 'HH' WHERE member_id = '10970' AND name = 'Neha Kapoor';

-- Priya Verma [11034] -> Diane Ward
UPDATE public.all_patients SET name = 'Diane Ward', initials = 'DW' WHERE member_id = '11034' AND name = 'Priya Verma';

-- Anaya Kapoor [11000] -> Julie Anderson
UPDATE public.all_patients SET name = 'Julie Anderson', initials = 'JA' WHERE member_id = '11000' AND name = 'Anaya Kapoor';

-- Aarav Kapoor [10997] -> Todd Thompson
UPDATE public.all_patients SET name = 'Todd Thompson', initials = 'TT' WHERE member_id = '10997' AND name = 'Aarav Kapoor';

-- Neha Singh [11106] -> Joyce Martinez
UPDATE public.all_patients SET name = 'Joyce Martinez', initials = 'JM' WHERE member_id = '11106' AND name = 'Neha Singh';

-- Isha Kapoor [11019] -> Grace Robinson
UPDATE public.all_patients SET name = 'Grace Robinson', initials = 'GR' WHERE member_id = '11019' AND name = 'Isha Kapoor';

-- Aarav Reddy [11084] -> Keith Clark
UPDATE public.all_patients SET name = 'Keith Clark', initials = 'KC' WHERE member_id = '11084' AND name = 'Aarav Reddy';

-- Isha Reddy [11118] -> Rose Rodriguez
UPDATE public.all_patients SET name = 'Rose Rodriguez', initials = 'RR' WHERE member_id = '11118' AND name = 'Isha Reddy';

-- Rahul Nair [11184] -> Douglas Lewis
UPDATE public.all_patients SET name = 'Douglas Lewis', initials = 'DL' WHERE member_id = '11184' AND name = 'Rahul Nair';

-- Rahul Kapoor [10953] -> Gerald Walker
UPDATE public.all_patients SET name = 'Gerald Walker', initials = 'GW' WHERE member_id = '10953' AND name = 'Rahul Kapoor';

-- Anaya Gupta [10971] -> Jean Hall
UPDATE public.all_patients SET name = 'Jean Hall', initials = 'JH' WHERE member_id = '10971' AND name = 'Anaya Gupta';

-- Ezra Chawla [11172] -> Walter Allen
UPDATE public.all_patients SET name = 'Walter Allen', initials = 'WA' WHERE member_id = '11172' AND name = 'Ezra Chawla';

-- Opal Iyer [11064] -> Mary Young
UPDATE public.all_patients SET name = 'Mary Young', initials = 'MY' WHERE member_id = '11064' AND name = 'Opal Iyer';

-- Rhys Menon [11141] -> James King
UPDATE public.all_patients SET name = 'James King', initials = 'JK' WHERE member_id = '11141' AND name = 'Rhys Menon';

-- Vera Rao [11003] -> Jennifer Wright
UPDATE public.all_patients SET name = 'Jennifer Wright', initials = 'JW' WHERE member_id = '11003' AND name = 'Vera Rao';

-- June Bhatt [11185] -> Linda Scott
UPDATE public.all_patients SET name = 'Linda Scott', initials = 'LS' WHERE member_id = '11185' AND name = 'June Bhatt';

-- Petra Malhotra [11062] -> Susan Torres
UPDATE public.all_patients SET name = 'Susan Torres', initials = 'ST' WHERE member_id = '11062' AND name = 'Petra Malhotra';

-- Kavya Trivedi [11132] -> Karen Nguyen
UPDATE public.all_patients SET name = 'Karen Nguyen', initials = 'KN' WHERE member_id = '11132' AND name = 'Kavya Trivedi';

-- Dev Ashford [11151] -> Michael Hill
UPDATE public.all_patients SET name = 'Michael Hill', initials = 'MH' WHERE member_id = '11151' AND name = 'Dev Ashford';

-- Nisha Bellamy [11161] -> Nancy Flores
UPDATE public.all_patients SET name = 'Nancy Flores', initials = 'NF' WHERE member_id = '11161' AND name = 'Nisha Bellamy';

-- Aditya Crowley [11030] -> Robert Green
UPDATE public.all_patients SET name = 'Robert Green', initials = 'RG' WHERE member_id = '11030' AND name = 'Aditya Crowley';

-- Tara Dunmore [11163] -> Betty Adams
UPDATE public.all_patients SET name = 'Betty Adams', initials = 'BA' WHERE member_id = '11163' AND name = 'Tara Dunmore';

-- Ishaan Ellery [11121] -> David Nelson
UPDATE public.all_patients SET name = 'David Nelson', initials = 'DN' WHERE member_id = '11121' AND name = 'Ishaan Ellery';

-- Meera Fairbank [11178] -> Sandra Baker
UPDATE public.all_patients SET name = 'Sandra Baker', initials = 'SB' WHERE member_id = '11178' AND name = 'Meera Fairbank';

-- Kabir Gresham [11159] -> Thomas Rivera
UPDATE public.all_patients SET name = 'Thomas Rivera', initials = 'TR' WHERE member_id = '11159' AND name = 'Kabir Gresham';

-- Neha Mehta [11005] -> Carol Campbell
UPDATE public.all_patients SET name = 'Carol Campbell', initials = 'CC' WHERE member_id = '11005' AND name = 'Neha Mehta';

-- Diya Gupta [11022] -> Michelle Mitchell
UPDATE public.all_patients SET name = 'Michelle Mitchell', initials = 'MM' WHERE member_id = '11022' AND name = 'Diya Gupta';

-- Karan Sharma [11070] -> Daniel Carter
UPDATE public.all_patients SET name = 'Daniel Carter', initials = 'DC' WHERE member_id = '11070' AND name = 'Karan Sharma';

-- Karan Kapoor [11095] -> Matthew Roberts
UPDATE public.all_patients SET name = 'Matthew Roberts', initials = 'MR' WHERE member_id = '11095' AND name = 'Karan Kapoor';

-- Anaya Mehta [11047] -> Laura Gomez
UPDATE public.all_patients SET name = 'Laura Gomez', initials = 'LG' WHERE member_id = '11047' AND name = 'Anaya Mehta';

-- Anaya Joshi [11103] -> Amy Phillips
UPDATE public.all_patients SET name = 'Amy Phillips', initials = 'AP' WHERE member_id = '11103' AND name = 'Anaya Joshi';

-- Arjun Nair [11048] -> Andrew Evans
UPDATE public.all_patients SET name = 'Andrew Evans', initials = 'AE' WHERE member_id = '11048' AND name = 'Arjun Nair';

-- Rahul Sharma [10978] -> Joseph Turner
UPDATE public.all_patients SET name = 'Joseph Turner', initials = 'JT' WHERE member_id = '10978' AND name = 'Rahul Sharma';

-- Mira Kapoor [11134] -> Kathleen Diaz
UPDATE public.all_patients SET name = 'Kathleen Diaz', initials = 'KD' WHERE member_id = '11134' AND name = 'Mira Kapoor';

-- Karan Mehta [11093] -> Brian Parker
UPDATE public.all_patients SET name = 'Brian Parker', initials = 'BP' WHERE member_id = '11093' AND name = 'Karan Mehta';

-- Isha Singh [11111] -> Angela Cruz
UPDATE public.all_patients SET name = 'Angela Cruz', initials = 'AC' WHERE member_id = '11111' AND name = 'Isha Singh';

-- Leela Hollis [11028] -> Melissa Edwards
UPDATE public.all_patients SET name = 'Melissa Edwards', initials = 'ME' WHERE member_id = '11028' AND name = 'Leela Hollis';

-- Miles Nair [11192] -> Kevin Collins
UPDATE public.all_patients SET name = 'Kevin Collins', initials = 'KC' WHERE member_id = '11192' AND name = 'Miles Nair';

-- Freya Bose [11115] -> Rebecca Reyes
UPDATE public.all_patients SET name = 'Rebecca Reyes', initials = 'RR' WHERE member_id = '11115' AND name = 'Freya Bose';

-- Samar Gresham [11180] -> Eric Stewart
UPDATE public.all_patients SET name = 'Eric Stewart', initials = 'ES' WHERE member_id = '11180' AND name = 'Samar Gresham';

-- Otis Saxena [11023] -> Scott Morris
UPDATE public.all_patients SET name = 'Scott Morris', initials = 'SM' WHERE member_id = '11023' AND name = 'Otis Saxena';

-- Lars Joshi [11162] -> Gregory Morales
UPDATE public.all_patients SET name = 'Gregory Morales', initials = 'GM' WHERE member_id = '11162' AND name = 'Lars Joshi';

-- Rohan Sethi [11073] -> Patrick Murphy
UPDATE public.all_patients SET name = 'Patrick Murphy', initials = 'PM' WHERE member_id = '11073' AND name = 'Rohan Sethi';

-- Sana Hollis [11181] -> Stephanie Cook
UPDATE public.all_patients SET name = 'Stephanie Cook', initials = 'SC' WHERE member_id = '11181' AND name = 'Sana Hollis';

-- Vivaan Ingram [11072] -> Jeffrey Rogers
UPDATE public.all_patients SET name = 'Jeffrey Rogers', initials = 'JR' WHERE member_id = '11072' AND name = 'Vivaan Ingram';

-- Riya Joplin [11036] -> Sharon Peterson
UPDATE public.all_patients SET name = 'Sharon Peterson', initials = 'SP' WHERE member_id = '11036' AND name = 'Riya Joplin';

-- Neha Gupta [11137] -> Cynthia Cooper
UPDATE public.all_patients SET name = 'Cynthia Cooper', initials = 'CC' WHERE member_id = '11137' AND name = 'Neha Gupta';

-- Vikram Reddy [11096] -> Ryan Reed
UPDATE public.all_patients SET name = 'Ryan Reed', initials = 'RR' WHERE member_id = '11096' AND name = 'Vikram Reddy';

-- Aarav Mehta [11133] -> Nathan Bailey
UPDATE public.all_patients SET name = 'Nathan Bailey', initials = 'NB' WHERE member_id = '11133' AND name = 'Aarav Mehta';

-- Rohan Mehta [11008] -> Tyler Bell
UPDATE public.all_patients SET name = 'Tyler Bell', initials = 'TB' WHERE member_id = '11008' AND name = 'Rohan Mehta';

-- Mira Singh [11177] -> Rachel Howard
UPDATE public.all_patients SET name = 'Rachel Howard', initials = 'RH' WHERE member_id = '11177' AND name = 'Mira Singh';

-- Mira Verma [11099] -> Janet Ward
UPDATE public.all_patients SET name = 'Janet Ward', initials = 'JW' WHERE member_id = '11099' AND name = 'Mira Verma';

-- Isha Patel [11130] -> Emma Anderson
UPDATE public.all_patients SET name = 'Emma Anderson', initials = 'EA' WHERE member_id = '11130' AND name = 'Isha Patel';

-- Rahul Verma [11142] -> Brandon Thompson
UPDATE public.all_patients SET name = 'Brandon Thompson', initials = 'BT' WHERE member_id = '11142' AND name = 'Rahul Verma';

-- Arjun Gupta [11017] -> Dennis Martinez
UPDATE public.all_patients SET name = 'Dennis Martinez', initials = 'DM' WHERE member_id = '11017' AND name = 'Arjun Gupta';

-- Vikram Kapoor [11077] -> Craig Robinson
UPDATE public.all_patients SET name = 'Craig Robinson', initials = 'CR' WHERE member_id = '11077' AND name = 'Vikram Kapoor';

-- Mira Reddy [11075] -> Catherine Clark
UPDATE public.all_patients SET name = 'Catherine Clark', initials = 'CC' WHERE member_id = '11075' AND name = 'Mira Reddy';

-- Mira Gupta [11122] -> Heather Rodriguez
UPDATE public.all_patients SET name = 'Heather Rodriguez', initials = 'HR' WHERE member_id = '11122' AND name = 'Mira Gupta';

-- Arjun Reddy [10976] -> Wayne Lewis
UPDATE public.all_patients SET name = 'Wayne Lewis', initials = 'WL' WHERE member_id = '10976' AND name = 'Arjun Reddy';

-- Neha Nair [11081] -> Diane Walker
UPDATE public.all_patients SET name = 'Diane Walker', initials = 'DW' WHERE member_id = '11081' AND name = 'Neha Nair';

-- Isha Joshi [11169] -> Julie Hall
UPDATE public.all_patients SET name = 'Julie Hall', initials = 'JH' WHERE member_id = '11169' AND name = 'Isha Joshi';

-- Arjun Verma [10956] -> Russell Allen
UPDATE public.all_patients SET name = 'Russell Allen', initials = 'RA' WHERE member_id = '10956' AND name = 'Arjun Verma';

-- Rahul Singh [10983] -> Carl Young
UPDATE public.all_patients SET name = 'Carl Young', initials = 'CY' WHERE member_id = '10983' AND name = 'Rahul Singh';

-- Rahul Patel [11046] -> Todd King
UPDATE public.all_patients SET name = 'Todd King', initials = 'TK' WHERE member_id = '11046' AND name = 'Rahul Patel';

-- Aarav Gupta [11086] -> Keith Wright
UPDATE public.all_patients SET name = 'Keith Wright', initials = 'KW' WHERE member_id = '11086' AND name = 'Aarav Gupta';

UPDATE public.snp_worklist_members s
SET    patient_id = s.id
FROM   public.patients p
WHERE  s.patient_id = p.id
AND    p.name <> s.name;

COMMIT;