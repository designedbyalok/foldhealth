import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabase';
import { FOLD_DB_MAP, loadFoldDbFromRows } from './data/fold-db.js';
import { parseXlsxDate } from './data/formatters.js';
import { parseXlsxArrayBuffer } from './xlsxLite.js';
import { useTableSort } from '../../components/HeaderCell/useTableSort';
import {
  POP_GROUPS, FILTER_OPTIONS, MEMBERSHIP_OPTS, CRIT_ATTRS,
  parseTable, groupSignature, reclassifyDuplicate,
} from './PopulationGroupsView.utils.js';

export function usePopulationGroupsView({
  activeFilter,
  onModalClose,
  onBackdropChange,
  onGroupCreated,
  onUploadError,
  onMemberAdded,
}) {
  const popGroups      = useAppStore(s => s.popGroups);
  const fetchPopGroups = useAppStore(s => s.fetchPopGroups);
  const createPopGroup = useAppStore(s => s.createPopGroup);
  const updatePopGroup = useAppStore(s => s.updatePopGroup);
  useEffect(() => { fetchPopGroups(); }, [fetchPopGroups]);

  /* Load the real patient directory (all_patients) so CSV uploads are matched
     against the DB rather than the bundled seed. Prefers dob when present;
     falls back gracefully if the column doesn't exist yet. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let { data, error } = await supabase.from('all_patients').select('id,name,dob,pcp');
      if (error) ({ data, error } = await supabase.from('all_patients').select('id,name,pcp'));
      if (!cancelled && !error && data?.length) loadFoldDbFromRows(data);
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── table state ── */
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [checkedRows,   setCheckedRows]   = useState(new Set());
  const [hoveredRow,    setHoveredRow]    = useState(null);
  const [popPage,       setPopPage]       = useState(1);
  const [popPageSize,   setPopPageSize]   = useState(10);
  const [popGoToInput,  setPopGoToInput]  = useState('');

  /* ── modal state ── */
  const [modalOpen,     setModalOpen]     = useState(false);
  const [segmentName,   setSegmentName]   = useState('');
  const [description,   setDescription]   = useState('');
  const [chosenFilter,  setChosenFilter]  = useState('');
  const [memberStatus,  setMemberStatus]  = useState('All Status');

  /* ── CSV upload state ── */
  const [dragOver,           setDragOver]           = useState(false);
  const [uploadFile,         setUploadFile]         = useState(null);
  const [showCloseConfirm,   setShowCloseConfirm]   = useState(false);
  const [uploadState,   setUploadState]   = useState('idle'); // idle|uploading|loading|complete
  const [uploadPct,     setUploadPct]     = useState(0);
  const procStepRef = useRef(0);
  const manualSelRef = useRef({});
  const patSearchRef = useRef('');

  /* ── summary / resolution ── */
  const [matchSummary,  setMatchSummary]  = useState({ matched:[], notFound:[], duplicates:[] });
  const [matchedExp,    setMatchedExp]    = useState(false);
  const [notFoundExp,   setNotFoundExp]   = useState(true);
  const [dupExp,        setDupExp]        = useState(true);

  /* Auto-expand Matched Members once all incorrect/duplicate entries are resolved */
  useEffect(() => {
    if (matchSummary.notFound.length === 0 && matchSummary.duplicates.length === 0 && matchSummary.matched.length > 0) {
      setMatchedExp(true);
    }
  }, [matchSummary.notFound.length, matchSummary.duplicates.length, matchSummary.matched.length]);
  const [patDDOpen,     setPatDDOpen]     = useState(null);
  const [patDDRect,     setPatDDRect]     = useState(null); // position for fixed portal dropdown
  const [showPreview,   setShowPreview]   = useState(false); // final preview before save

  /* ── dynamic criteria ── */
  const [criteria,      setCriteria]      = useState([{ attr:'Age', op:'≥', val:'' }]);

  /* ── collapsed mini-bar (now owned by the persistent store/host) ── */

  const startPgSession  = useAppStore(s => s.startPgSession);
  const expandPgSession = useAppStore(s => s.expandPgSession);
  const closePgSession  = useAppStore(s => s.closePgSession);
  const pgSession       = useAppStore(s => s.pgSession);
  const pgReopenToken   = useAppStore(s => s.pgReopenToken);
  const showToast       = useAppStore(s => s.showToast);

  /* ── dev toggle ── */
  const [showDevButtons, setShowDevButtons] = useState(false);
  /* tableMode / smartMode / enhancedMode / tableRows / tableRowsRef removed (dead code) */

  /* ── new "Download Errors" Create Group flow ── */
  const [newMode,      setNewMode]      = useState(false);
  /* ── edit flow (editing a saved static-CSV group) ── */
  const [editGroupId,  setEditGroupId]  = useState(null);
  const [editBaseline, setEditBaseline] = useState(null); // signature of the loaded group — drives dirty state
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  /* edit phase 2 — new "Update Population Group" drawer (replaces the in-create edit reuse) */
  const [editingGroup, setEditingGroup] = useState(null);

  const fileInputRef  = useRef(null);
  const parsedRef        = useRef(null); // stores parsed match results while loading timer runs
  const loadingStartRef  = useRef(null); // timestamp when loading began (for mini-bar hand-off)
  const uploadTickRef    = useRef(null); // progress-animation interval, cleared on unmount

  /* The upload progress interval is started from an event handler, so nothing
     stops it if the view unmounts mid-upload — it would keep calling
     setUploadPct on a dead component. Own it here. */
  useEffect(() => () => clearInterval(uploadTickRef.current), []);

  /* ── close dropdowns on outside click ── */
  useEffect(() => {
    const handler = e => {
      if (!e.target.closest?.('[data-patdd]')) setPatDDOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── loading → sequential steps → complete ── */
  useEffect(() => {
    if (uploadState !== 'loading') { procStepRef.current = 0; return; }
    loadingStartRef.current = Date.now();
    procStepRef.current = 0;
    if (parsedRef.current) {
      setMatchSummary(parsedRef.current);
      parsedRef.current = null;
    }
    /* tableRowsRef removed */
    // Advance each step sequentially; complete after 30 s
    const t1 = setTimeout(() => { procStepRef.current = 1; },  8000);
    const t2 = setTimeout(() => { procStepRef.current = 2; }, 18000);
    const t3 = setTimeout(() => { procStepRef.current = 3; }, 28000);
    const t4 = setTimeout(() => setUploadState('complete'), 30000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [uploadState]);

  /* ── tell App when the drawer backdrop should show (for off-screen rendering) ── */
  useEffect(() => {
    onBackdropChange?.(modalOpen);
  }, [modalOpen]);

  /* ── reopen the drawer at the completed summary when the mini-bar is expanded ── */
  useEffect(() => {
    if (!pgReopenToken) return;
    const s = useAppStore.getState().pgSession;
    if (!s) return;
    resetModalState();
    setNewMode(true);
    setChosenFilter('static-csv');
    setSegmentName(s.segName || '');
    setUploadFile({ name: s.fileName, size: s.fileSize });
    setMatchSummary(s.result || { matched: [], notFound: [], duplicates: [] });
    setUploadState('complete');
    setModalOpen(true);
    closePgSession();
  }, [pgReopenToken]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── helpers ── */
  const resetModalState = () => {
    /* tableMode / smartMode / enhancedMode / tableRows cleared here — state removed */
    setNewMode(false); setEditGroupId(null);
    setSegmentName(''); setDescription(''); setChosenFilter('');
    setMemberStatus('All Status'); setUploadFile(null);
    setUploadState('idle'); setUploadPct(0); setDragOver(false);
    setCriteria([{ attr:'Age', op:'≥', val:'' }]);
    setMatchedExp(false);
    setNotFoundExp(true); setDupExp(true);
    manualSelRef.current = {}; setPatDDOpen(null); setShowPreview(false);
    setMatchSummary({ matched:[], notFound:[], duplicates:[] }); patSearchRef.current = '';
    parsedRef.current = null;
  };
  const openModal = () => { resetModalState(); setModalOpen(true); };
  const openNewModal = () => { resetModalState(); setNewMode(true); setModalOpen(true); };
  /* Edit a saved static-CSV group: reopen the matched/complete drawer with its members. */
  /* ── edit phase 2 ──────────────────────────────────────────────────────────
     The edit flow is being rebuilt as a dedicated "Update Population Group"
     drawer (<UpdatePopGroupDrawer>). The old approach reused the create
     drawer's CSV review state — kept here, commented out, for reference. */
  const openEditModal = (group) => {
    setEditingGroup(group);
  };
  // const openEditModal = (group) => {
  //   resetModalState();
  //   setNewMode(true);
  //   setEditGroupId(group.id);
  //   setSegmentName(group.name || '');
  //   setDescription(group.description || '');
  //   setChosenFilter('static-csv');
  //   setMemberStatus(group.memberStatus || 'All Status');
  //   const members = (group.memberIds || [])
  //     .map(id => FOLD_DB_MAP[String(id).toUpperCase()])
  //     .filter(Boolean)
  //     .map(p => ({ id: p.id, name: p.name, dob: p.dob, mrn: p.id, pcp: p.pcp }));
  //   setUploadFile({ name: group.fileName || `${group.name || 'patient-list'}.csv`, size: 0 });
  //   setMatchSummary({ matched: members, notFound: [], duplicates: [] });
  //   setUploadState('complete');
  //   setEditBaseline(groupSignature({
  //     name: group.name || '',
  //     description: group.description || '',
  //     memberStatus: group.memberStatus || 'All Status',
  //     memberIds: members.map(m => m.id),
  //   }));
  //   setModalOpen(true);
  // };
  /* openTableModal / openSmartModal / openEnhancedModal removed */
  const closeModal = () => {
    setModalOpen(false); setUploadState('idle'); setShowSaveConfirm(false); setEditBaseline(null); onModalClose?.();
  };

  /* Persist the current group (insert on create, update on edit). Returns true on success. */
  const saveGroup = async () => {
    const groupType = chosenFilter === 'dynamic' ? 'Dynamic' : 'Static';
    const newName = segmentName.trim();
    const memberIds = matchSummary.matched.flatMap(m => m.id ? [m.id] : []);
    const payload = {
      name: newName, description: description.trim(), type: groupType,
      filterType: chosenFilter || null, memberStatus, memberIds,
      count: previewPatients.length || matchSummary.matched.length, inactive: 0,
    };
    const saved = editGroupId ? await updatePopGroup(editGroupId, payload) : await createPopGroup(payload);
    if (!saved) return false;   // DB error — keep drawer open, toast already shown
    onGroupCreated?.(newName);
    showToast(editGroupId ? 'Population Group Updated Successfully' : 'Population Group Added Successfully');
    closeModal();
    return true;
  };

  const handleFile = file => {
    if (!file) return;
    /* ── Validate file size (max 5 MB) ── */
    if (file.size > 5 * 1024 * 1024) {
      onUploadError?.('Error! File Size Too Large');
      return;
    }
    setUploadFile(file); setUploadState('uploading'); setUploadPct(0);
    setMatchSummary({ matched:[], notFound:[], duplicates:[] });
    manualSelRef.current = {}; setShowPreview(false); parsedRef.current = null;

    /* ── Animate progress over ~5 s (≈2–4 % per 200 ms tick) ── */
    const startTime = Date.now();
    let pct = 0;
    clearInterval(uploadTickRef.current);
    const iv = setInterval(() => {
      pct += Math.random() * 3 + 1;
      if (pct >= 100) { clearInterval(iv); setUploadPct(100); }
      else setUploadPct(Math.round(pct));
    }, 200);
    uploadTickRef.current = iv;

    const isXlsx = /\.xlsx$/i.test(file.name || '');
    const reader = new FileReader();
    reader.onload = async e => {
      /* ── Parse immediately; store in ref. .xlsx → unzip+inflate reader, else CSV/HTML-table text ── */
      try {
        const rows = isXlsx ? await parseXlsxArrayBuffer(e.target.result) : parseTable(e.target.result);
        if (rows.length) {
          const headers   = rows[0].map(h => String(h).toLowerCase());
          const idColIdx  = headers.findIndex(h => h.includes('patient') || h.includes('id'));
          const nameColIdx= headers.findIndex(h => h.includes('name') && !h.includes('first') && !h.includes('last'));
          const fnColIdx  = headers.findIndex(h => h.includes('first'));
          const lnColIdx  = headers.findIndex(h => h.includes('last'));
          const dobColIdx = headers.findIndex(h => h.includes('dob') || h.includes('birth') || h.includes('date'));
          const col       = idColIdx >= 0 ? idColIdx : 0;
          const nameCol   = nameColIdx >= 0 ? nameColIdx : -1;
          const fnCol     = fnColIdx  >= 0 ? fnColIdx  : -1;
          const lnCol     = lnColIdx  >= 0 ? lnColIdx  : -1;
          const dobCol    = dobColIdx >= 0 ? dobColIdx : -1;

          /* Pre-scan: count occurrences per rawId so we know which are duplicates */
          const idCount = new Map();
          rows.slice(1).forEach(row => {
            const rawId = String(row[col] || '').trim();
            if (rawId) idCount.set(rawId, (idCount.get(rawId) || 0) + 1);
          });

          /* Classify rows: IDs with count > 1 ALL go to duplicates (even if invalid).
             After one duplicate is removed, the remaining entry is reclassified.         */
          const seen = new Map();
          const matched = [], notFound = [], duplicates = [];
          let nfIdx = 0, dupIdx = 0;
          rows.slice(1).forEach(row => {
            const rawId  = String(row[col] || '').trim();
            let rawFn    = fnCol   >= 0 ? String(row[fnCol]   || '').trim() : '';
            let rawLn    = lnCol   >= 0 ? String(row[lnCol]   || '').trim() : '';
            let rawName  = nameCol >= 0 ? String(row[nameCol] || '').trim() : '';
            if (!rawFn && !rawLn && rawName) { const p = rawName.split(' '); rawFn = p[0]||''; rawLn = p.slice(1).join(' '); }
            if (!rawName) rawName = [rawFn, rawLn].filter(Boolean).join(' ');
            const rawDob = dobCol >= 0 ? parseXlsxDate(row[dobCol]) : '';
            if (!rawId) return;
            const occ = seen.get(rawId) || 0;
            seen.set(rawId, occ + 1);
            const dbPat = FOLD_DB_MAP[rawId.toUpperCase()];
            const isDup = (idCount.get(rawId) || 0) > 1;

            if (isDup) {
              /* All occurrences of a duplicated ID go to duplicates section */
              duplicates.push({ entryId:`dup${++dupIdx}`, rawId, rawName: rawName || rawId, rawFn, rawLn, rawDob, dbPat });
            } else if (!dbPat) {
              notFound.push({ entryId:`nf${++nfIdx}`, rawId, rawName: rawName || rawId, rawFn, rawLn, rawDob });
            } else {
              const dbParts = (dbPat.name || '').toLowerCase().split(' ');
              const dbFn = dbParts[0] || '';
              const dbLn = dbParts.slice(1).join(' ');
              const fnOk  = rawFn.trim().toLowerCase() === dbFn;
              const lnOk  = rawLn.trim().toLowerCase() === dbLn;
              /* Validate dob only when the DB carries it; otherwise match on id+name. */
              const dobOk = !dbPat.dob || rawDob === dbPat.dob;
              if (fnOk && lnOk && dobOk) {
                matched.push({ id: dbPat.id, name: dbPat.name, dob: dbPat.dob, mrn: dbPat.id, pcp: dbPat.pcp });
              } else {
                notFound.push({ entryId:`nf${++nfIdx}`, rawId, rawName: rawName || rawId, rawFn, rawLn, rawDob });
              }
            }
          });
          parsedRef.current = { matched, notFound, duplicates };

          // Parse into table rows (serial order from Excel)
          const headerRow = rows[0].map(h => String(h).toLowerCase());
          const idIdx    = headerRow.findIndex(h => h.includes('fold') || h.includes('patient') || h.includes('id'));
          const fnIdx    = headerRow.findIndex(h => h.includes('first'));
          const lnIdx    = headerRow.findIndex(h => h.includes('last'));
          const nameIdx  = headerRow.findIndex(h => h.includes('name') && !h.includes('first') && !h.includes('last'));
          const dobIdx   = headerRow.findIndex(h => h.includes('dob') || h.includes('birth') || h.includes('date'));
          const idC  = idIdx  >= 0 ? idIdx  : 0;
          const dobC = dobIdx >= 0 ? dobIdx : -1;

          /* tableRowsRef population removed (tableMode dead code) */
        }
      } catch(err) { console.error('Parse error', err); onUploadError?.('Error! Unable to Upload File'); }

      /* ── Wait until ≥5 s have elapsed, then transition to loading ── */
      clearInterval(iv);
      const elapsed = Date.now() - startTime;
      const delay   = Math.max(0, 5000 - elapsed);
      setTimeout(() => {
        setUploadPct(100);
        setTimeout(() => setUploadState('loading'), 500);
      }, delay);
    };
    if (isXlsx) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  };

  /* Close patient dropdown on outside click */
  useEffect(() => {
    if (!patDDOpen) return;
    const handler = e => {
      if (!e.target.closest('[data-patdd]') && !e.target.closest('[data-patdd-portal]')) {
        setPatDDOpen(null); patSearchRef.current = '';
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [patDDOpen]);

  const addCriterion    = ()        => setCriteria(p => [...p, { attr:'Age', op:'≥', val:'' }]);
  const removeCriterion = idx       => setCriteria(p => p.filter((_,i) => i !== idx));
  const updateCriterion = (i,k,v)   => setCriteria(p => p.map((c,ci) => ci===i ? { ...c,[k]:v } : c));

  /* ── filtered list ── */
  const activeType = activeFilter === 'Static' || activeFilter === 'Dynamic' ? activeFilter : null;
  const displayedGroups = [...popGroups, ...POP_GROUPS].flatMap(g => {
    if (activeType && g.type !== activeType) return [];
    if (searchQuery && !g.name.toLowerCase().includes(searchQuery.toLowerCase())) return [];
    return [{
      ...g,
      /* numeric keys so date columns sort chronologically (display stays formatted) */
      _createdTs: Date.parse(g.created) || 0,
      _updatedTs: Date.parse(g.updated) || 0,
    }];
  });

  /* Client-side sorting for member counts + dates — same hook TOC/HCC use */
  const { sorted: sortedGroups, sortKey: pgSortKey, sortDir: pgSortDir, requestSort: pgRequestSort } = useTableSort(displayedGroups);

  /* ── pagination ── */
  const totalGroups  = sortedGroups.length;
  const popTotalPages = Math.max(1, Math.ceil(totalGroups / popPageSize));
  const safePg       = Math.min(popPage, popTotalPages);
  const pagedGroups  = sortedGroups.slice((safePg - 1) * popPageSize, safePg * popPageSize);

  /* reset to page 1 whenever filter/search changes */
  useEffect(() => { setPopPage(1); }, [activeFilter, searchQuery, pgSortKey, pgSortDir]);

  const buildPopPages = () => {
    if (popTotalPages <= 7) return Array.from({ length: popTotalPages }, (_, i) => i + 1);
    if (safePg <= 4)        return [1, 2, 3, 4, 5, '...', popTotalPages];
    if (safePg >= popTotalPages - 3) return [1, '...', popTotalPages-4, popTotalPages-3, popTotalPages-2, popTotalPages-1, popTotalPages];
    return [1, '...', safePg - 1, safePg, safePg + 1, '...', popTotalPages];
  };

  const isCsvMode    = chosenFilter === 'static-csv';
  const canCreate    = segmentName.trim() && chosenFilter && (chosenFilter !== 'static-csv' || uploadState === 'complete');
  /* Edit mode: only "dirty" once name/description/status/members differ from the loaded group. */
  const isDirty      = editGroupId
    ? groupSignature({ name: segmentName, description, memberStatus, memberIds: matchSummary.matched.map(m => m.id) }) !== editBaseline
    : true;
  /* Save is enabled only when valid AND (create mode OR an edit actually changed something). */
  const canSave      = canCreate && isDirty;

  /* Header / cell styling — matches the Settings → Account → Users table (AccountPanel.module.css) */
  const unmatchedAll     = [...matchSummary.notFound]; /* duplicates don't block preview */
  const allResolved      = unmatchedAll.length > 0 && unmatchedAll.every(e => manualSelRef.current[e.entryId]);
  /* For the grey default CSV flow: Create is only enabled once all incorrect + duplicate entries are dealt with */
  const csvAllClear  = matchSummary.notFound.length === 0 && matchSummary.duplicates.length === 0;
  const canCreatePrimary = canCreate && (
    chosenFilter !== 'static-csv' ||
    (uploadState === 'complete' && csvAllClear) ||  // default CSV flow: all errors cleared
    allResolved ||
    showPreview
  );
  const previewPatients = [
    ...matchSummary.matched.map(p  => ({ ...p, source:'Matched' })),
    ...Object.values(manualSelRef.current).map(p => ({ ...p, mrn: p.id || '—', source:'Manual' })),
  ];

  /* ══════════════════════════════════════════════════════════════════════════ */
  return {
    // table
    searchQuery, setSearchQuery, searchOpen, setSearchOpen,
    checkedRows, setCheckedRows, hoveredRow, setHoveredRow,
    popPage, setPopPage, popPageSize, setPopPageSize, popGoToInput, setPopGoToInput,
    sortedGroups, pgSortKey, pgSortDir, pgRequestSort,
    popTotalPages, safePg, pagedGroups, buildPopPages,
    openEditModal, openNewModal,
    // modal
    modalOpen, setModalOpen, segmentName, setSegmentName, description, setDescription,
    chosenFilter, setChosenFilter, memberStatus, setMemberStatus,
    dragOver, setDragOver, uploadFile, setUploadFile,
    showCloseConfirm, setShowCloseConfirm, uploadState, setUploadState, uploadPct,
    matchSummary, setMatchSummary, matchedExp, setMatchedExp,
    notFoundExp, setNotFoundExp, dupExp, setDupExp,
    patDDOpen, setPatDDOpen, showPreview, setShowPreview,
    criteria, setCriteria, newMode, editGroupId, showSaveConfirm, setShowSaveConfirm,
    editingGroup, setEditingGroup,
    fileInputRef, procStepRef, manualSelRef, patSearchRef, parsedRef, loadingStartRef,
    closeModal, saveGroup, handleFile,
    addCriterion, removeCriterion, updateCriterion,
    isCsvMode, canSave, isDirty, csvAllClear, previewPatients,
    unmatchedAll, allResolved, canCreatePrimary,
    startPgSession, closePgSession, showToast, updatePopGroup,
    reclassifyDuplicate, resetModalState,
  };
}
