import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GridLayout from 'react-grid-layout/legacy';
import { Icon } from '../../components/Icon/Icon';
import { Select } from '../../components/Select/Select';
import { TopBar } from '../../components/TopBar/TopBar';
import { TodayView } from './today/TodayView';
import { WelcomeCard } from './WelcomeCard';
import { AlertsMonitoringCard } from './AlertsMonitoringCard';
import { AssignedToMeCard } from './AssignedToMeCard';
import { TodayCalendarCard } from './TodayCalendarCard';
import { TasksCard } from './TasksCard';
import { QuickNotesCard } from './QuickNotesCard';
import { TeamProgramsCard } from './TeamProgramsCard';
import { useProgramAccess } from '../patient/hooks/useProgramAccess';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import styles from './HomeView.module.css';

const STORAGE_KEY = 'home-dashboard-layout-v2';
const DRAG_HANDLE = 'home-drag-handle';
const COLS = 12;
const ROW_HEIGHT = 40;

const DEFAULT_LAYOUT = [
  { i: 'welcome',  x: 0, y: 0,  w: 6, h: 4,  minW: 4, minH: 4, maxH: 6 },
  // Supervisors only; hidden for everyone else (see visibleLayout).
  { i: 'team',     x: 0, y: 4,  w: 6, h: 8,  minW: 4, minH: 5 },
  { i: 'alerts',   x: 0, y: 12, w: 6, h: 16, minW: 4, minH: 8 },
  { i: 'assigned', x: 6, y: 0,  w: 3, h: 5,  minW: 2, minH: 3 },
  { i: 'calendar', x: 9, y: 0,  w: 3, h: 20, minW: 2, minH: 6 },
  { i: 'tasks',    x: 6, y: 5,  w: 3, h: 11, minW: 2, minH: 4 },
  { i: 'notes',    x: 6, y: 16, w: 3, h: 4,  minW: 2, minH: 3 },
];

const DEFAULT_ORDER = Object.fromEntries(DEFAULT_LAYOUT.map((l, idx) => [l.i, idx]));

function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_LAYOUT;
    const known = new Set(DEFAULT_LAYOUT.map(l => l.i));
    const kept = parsed.filter(l => known.has(l?.i));
    // A card added since the layout was saved joins at its default spot
    // rather than resetting the whole layout.
    const have = new Set(kept.map(l => l.i));
    return [...kept, ...DEFAULT_LAYOUT.filter(l => !have.has(l.i))];
  } catch {
    return DEFAULT_LAYOUT;
  }
}

// Home has two views: the draggable card Dashboard and the Today NBA feed.
const VIEW_KEY = 'home-view-mode';
const VIEW_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'today', label: 'Today' },
];

const CARD_RENDERERS = {
  welcome:  WelcomeCard,
  alerts:   AlertsMonitoringCard,
  assigned: AssignedToMeCard,
  calendar: TodayCalendarCard,
  tasks:    TasksCard,
  notes:    QuickNotesCard,
  team:     TeamProgramsCard,
};

export function HomeView() {
  const [layout, setLayout] = useState(loadLayout);
  const [editing, setEditing] = useState(false);
  const [view, setView] = useState(() => {
    try { return localStorage.getItem(VIEW_KEY) || 'dashboard'; } catch { return 'dashboard'; }
  });
  const containerRef = useRef(null);
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth - 24);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Supervisors see Team programs for the programs they supervise; admins for
  // every program (codes null).
  const access = useProgramAccess();
  const supervisedCodes = useMemo(
    () => (access.admin ? null : access.programs.filter(code => access.levels[code] === 'supervisor')),
    [access.admin, access.programs, access.levels],
  );
  const showTeam = access.admin || supervisedCodes.length > 0;
  // In default order: where two cards claim the same spot (Team programs
  // appearing once access loads), the grid keeps the earlier one in place
  // and pushes the other down.
  const visibleLayout = useMemo(() => layout
    .filter(l => l.i !== 'team' || showTeam)
    .sort((a, b) => DEFAULT_ORDER[a.i] - DEFAULT_ORDER[b.i]), [layout, showTeam]);

  // The grid only reports visible cards, so a hidden card keeps its spot.
  const handleLayoutChange = useCallback((next) => {
    setLayout(prev => {
      const seen = new Set(next.map(l => l.i));
      return [...next, ...prev.filter(l => !seen.has(l.i))];
    });
  }, []);
  // Saved here rather than in the updater, which React may run twice.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch { /* private mode */ }
  }, [layout]);

  const resetLayout = useCallback(() => setLayout(DEFAULT_LAYOUT), []);

  const changeView = useCallback((next) => {
    setView(next);
    if (next !== 'dashboard') setEditing(false);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* private mode */ }
  }, []);

  const items = useMemo(() => visibleLayout.map(l => {
    const Card = CARD_RENDERERS[l.i];
    return (
      <div key={l.i}>
        <Card dragHandleClassName={editing ? DRAG_HANDLE : undefined} {...(l.i === 'team' ? { codes: supervisedCodes } : {})} />
      </div>
    );
  }), [visibleLayout, editing, supervisedCodes]);

  return (
    <div className={styles.page}>
      <TopBar />
      <div className={styles.toolbar}>
        <Select
          options={VIEW_OPTIONS}
          value={view}
          onValueChange={changeView}
          variant="ghost"
          leadingIcon={view === 'today' ? 'solar:sun-linear' : 'solar:chart-linear'}
          style={{ width: 148 }}
        />
        {view === 'dashboard' && (
          <div style={{ display: 'flex', gap: 4 }}>
            {editing && (
              <button className={styles.toolbarBtn} onClick={resetLayout}>
                <Icon name="solar:refresh-linear" size={14} />
                Reset
              </button>
            )}
            <button
              className={[styles.toolbarBtn, editing ? styles.editing : ''].filter(Boolean).join(' ')}
              onClick={() => setEditing(v => !v)}
            >
              <Icon name={editing ? 'solar:check-circle-linear' : 'solar:pen-linear'} size={14} />
              {editing ? 'Done' : 'Edit Dashboard'}
            </button>
          </div>
        )}
      </div>
      {view === 'today' ? (
        <TodayView />
      ) : (
      <div
        ref={containerRef}
        className={[styles.gridContainer, editing ? styles.editing : ''].filter(Boolean).join(' ')}
      >
        <GridLayout
          className="layout"
          layout={visibleLayout}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          width={width}
          margin={[12, 12]}
          containerPadding={[0, 0]}
          isDraggable={editing}
          isResizable={editing}
          draggableHandle={`.${DRAG_HANDLE}`}
          onLayoutChange={handleLayoutChange}
          compactType="vertical"
          preventCollision={false}
        >
          {items}
        </GridLayout>
      </div>
      )}
    </div>
  );
}
