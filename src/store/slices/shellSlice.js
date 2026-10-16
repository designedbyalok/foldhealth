import { supabase } from '../../lib/supabase';
import { track } from '../../lib/tracking';
import {
  applyTheme,
  subscribeToSystem,
  applyNavStyle,
  applyContrast,
  applyFontScale,
  applySidebarShape,
  applyFloatingDensity,
} from '../../lib/theme';
import {
  initialThemeSetting,
  initialResolvedTheme,
  initialNavStyle,
  initialContrast,
  initialFontScale,
  initialSidebarShape,
  initialFloatingDensity,
  readChangelogSeenAt,
  readProgramPanelSplit,
} from '../shellInitial';

/** Theme, chrome preferences, Featurebase JWT, and changelog — shell concerns only. */
export function createShellSlice(set, get) {
  return {
    theme: initialThemeSetting,
    resolvedTheme: initialResolvedTheme,
    setTheme: (next) => {
      const from = get().theme;
      track('theme.changed', { from, to: next });
      const resolved = applyTheme(next);
      set({ theme: next, resolvedTheme: resolved });
    },
    _initThemeSubscriptions: () => {
      if (get()._themeSubscribed) return;
      set({ _themeSubscribed: true });
      subscribeToSystem(
        () => get().theme,
        (resolved) => set({ resolvedTheme: resolved })
      );
    },
    _themeSubscribed: false,

    navStyle: initialNavStyle,
    setNavStyle: (next) => {
      const from = get().navStyle;
      track('nav.style_changed', { from, to: next });
      const applied = applyNavStyle(next);
      set({ navStyle: applied });
    },

    contrast: initialContrast,
    setContrast: (next) => {
      const from = get().contrast;
      track('contrast.changed', { from, to: next });
      const applied = applyContrast(next);
      set({ contrast: applied });
    },

    fontScale: initialFontScale,
    setFontScale: (next) => {
      const from = get().fontScale;
      track('fontScale.changed', { from, to: next });
      const applied = applyFontScale(next);
      set({ fontScale: applied });
    },

    sidebarShape: initialSidebarShape,
    setSidebarShape: (next) => {
      const from = get().sidebarShape;
      track('sidebarShape.changed', { from, to: next });
      const applied = applySidebarShape(next);
      set({ sidebarShape: applied });
    },

    floatingDensity: initialFloatingDensity,
    setFloatingDensity: (next) => {
      const from = get().floatingDensity;
      track('floatingDensity.changed', { from, to: next });
      const applied = applyFloatingDensity(next);
      set({ floatingDensity: applied });
    },

    // An open care program as its own card beside the patient card. Only
    // honored with the floating sidebar; see useProgramPanelSplitActive.
    programPanelSplit: readProgramPanelSplit(),
    setProgramPanelSplit: (next) => {
      track('programPanelSplit.changed', { to: next });
      try { localStorage.setItem('programPanelSplit', String(next)); } catch { /* private mode */ }
      set({ programPanelSplit: next });
    },

    // The split layout's panel stack, right of the patient card:
    // { programKey, ids, activeId } | null. `programKey` is the main panel it
    // was built over (an open program's key, or 'patient-plan'); ids are panel
    // ids in display order ('program' is the main panel, 'careplan' a program's
    // care plan opened on its own, 'tab:<name>' a right-panel tab). In the
    // store so a care plan header can open its plan as a panel. See
    // PatientDetailView and hooks/useProgramPanelSplitActive.
    programPanelStack: null,
    setProgramPanelStack: (next) => set(s => ({
      programPanelStack: typeof next === 'function' ? next(s.programPanelStack) : next,
    })),

    featurebaseJwt: null,
    _featurebaseJwtPending: false,
    setFeaturebaseJwt: (jwt) => set({ featurebaseJwt: jwt }),
    resetFeaturebaseJwt: () => set({ featurebaseJwt: null, _featurebaseJwtPending: false }),
    ensureFeaturebaseJwt: async () => {
      if (get().featurebaseJwt || get()._featurebaseJwtPending) return;
      const { data } = await supabase.auth.getSession();
      if (!data?.session?.user) return;
      set({ _featurebaseJwtPending: true });
      const { data: minted, error } = await supabase.functions.invoke('featurebase-jwt');
      if (error) console.warn('[featurebase] jwt mint failed:', error.message);
      set({ featurebaseJwt: minted?.jwt || null, _featurebaseJwtPending: false });
    },

    changelogEntries: [],
    changelogLoading: false,
    _changelogFetched: false,
    changelogSeenAt: readChangelogSeenAt(),
    fetchChangelog: async () => {
      if (get()._changelogFetched) return;
      set({ _changelogFetched: true, changelogLoading: true });
      const { data, error } = await supabase
        .from('changelog_entries')
        .select('id, title, kind, compare_url, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) console.warn('[store] changelog fetch failed:', error.message);
      set({ changelogEntries: data || [], changelogLoading: false });
    },
    markChangelogSeen: () => {
      const now = new Date().toISOString();
      try { localStorage.setItem('changelogSeenAt', now); } catch { /* private mode */ }
      set({ changelogSeenAt: now });
    },
  };
}
