// React Doctor config. `defineConfig` from the package isn't resolvable
// through react-doctor's own config loader (CJS interop), so we export a
// plain object — it's just an identity helper anyway.
export default {
  ignore: {
    rules: [
      // ── Deferred migration-scale rules (2026-08) ────────────────────────
      // Each of these spans dozens-to-hundreds of sites; fixing them blind in
      // one pass is riskier than the warnings themselves. Re-enable one at a
      // time when there's appetite for a dedicated migration PR.
      'react-doctor/no-array-index-as-key',      // 204 sites — key changes alter list reconciliation
      'react-doctor/exhaustive-deps',            // 72 sites — dep additions can loop/change behavior
      'react-doctor/prefer-useReducer',          // pure refactor preference
      'react-doctor/prefer-use-effect-event',    // needs React experimental useEffectEvent
      // ── Accepted codebase patterns (verified by reading the sites) ──────
      // Deliberate orchestration idioms used consistently across the app:
      // reset-dialog-state-on-open, pagination reset → fetch effect,
      // publish-save-API-to-drawer-header, load state machines. Restructuring
      // them is architecture work, not a lint fix.
      'react-doctor/no-adjust-state-on-prop-change',
      'react-doctor/no-effect-chain',
      'react-doctor/no-reset-all-state-on-prop-change',
      'react-doctor/no-pass-live-state-to-parent',
      'react-doctor/no-pass-data-to-parent',
      'react-doctor/no-prop-callback-in-effect',
      // Every localStorage read in this repo goes through a try/catch +
      // shape-check helper with a default fallback (_readJson etc.), so a
      // payload shape change degrades to defaults instead of crashing —
      // version envelopes would add migration risk for no real safety gain.
      'react-doctor/client-localstorage-no-version',
    ],
    // Non-source paths that inflate the scan. `.claude/worktrees/**` holds
    // full duplicate copies of the repo (incl. raw supabase SQL), which is
    // what drags the score to 0. Matched relative to the repo root.
    files: [
      '.claude/**',
      '.kiro/**',
      '.agents/**',
      'dist/**',
      'storybook-static/**',
      'docs/**',
    ],
    // False positives for supabase-client-owned-authz-field, verified by
    // reading each site: a realtime typing-broadcast compare (no DB write),
    // a read/derive of `role` for display, and an HCC worklist column
    // selector also named `role` (not an auth role).
    overrides: [
      // unused-file cannot see platform entry points. Serverless functions are
      // invoked over HTTP, never imported, so the rule reports every one of
      // them as dead code. They are emphatically not: vercel.json rewrites
      // `/s/:section` -> `/api/share?s=:section`, and the supabase/ functions
      // are deployed separately with `supabase functions deploy`. Deleting any
      // of these breaks production, so the rule is scoped off these paths
      // rather than left to mislead the next person reading the report.
      //
      // Note this suppresses ONLY unused-file — every other rule still applies
      // here, which matters because api/share.js has had real security
      // findings (see the jsonForScript escape).
      {
        files: [
          'api/**',
          'netlify/functions/**',
          'supabase/functions/**',

          // hcc-archived is an INTENTIONAL archive, not dead code. AppLayout
          // documents it as a frozen snapshot of HCC, lazy-loaded so upstream
          // HCC changes never alter it, and it is reachable in the product via
          // the "HCC (Archived)" worklist. Most of its internals are naturally
          // unreferenced from the live tree — that is what an archive looks
          // like — so unused-file flags ~50 of them and would keep tempting
          // whoever reads the report next to delete a deliberate snapshot.
          // Confirmed with the code owner (2026-08): keep it.
          'src/features/hcc-archived/**',
        ],
        // Note the `deslop/` prefix — dead-code analysis comes from deslop-js,
        // not the react-doctor oxlint plugin, so `react-doctor/unused-file`
        // silently matches nothing.
        rules: ['deslop/unused-file'],
      },

      { files: ['src/features/messages/ChatArea.jsx'], rules: ['react-doctor/supabase-client-owned-authz-field'] },
      { files: ['src/features/settings/account/AccountPanel.jsx'], rules: ['react-doctor/supabase-client-owned-authz-field'] },
      { files: ['src/store/useAppStore.js'], rules: ['react-doctor/supabase-client-owned-authz-field'] },

      // ProductTour reads/writes its own row keyed by a `user_id` taken from
      // supabase.auth.getUser() — there is no client-side change that makes a
      // client filter into a security boundary. Enforcement lives in the
      // database: user_tour_status is scoped to auth.uid() and defaults the
      // owner column server-side (applied; 0 anon policies remain on it).
      // Covers ProductTour.utils.js too — the helpers were extracted there and
      // a path-scoped suppression does not follow a refactor.
      {
        files: [
          'src/components/ProductTour/ProductTour.jsx',
          'src/components/ProductTour/ProductTour.utils.js',
        ],
        rules: ['react-doctor/supabase-client-owned-authz-field'],
      },

      // InviteUserDrawer assigns admin_role / role / clinical_roles when an
      // administrator invites someone. That is the intended behaviour of the
      // user-management flow, and it IS enforced server-side: profiles carries
      // "Admins can update any profile" (UPDATE, to authenticated) gated on
      //   EXISTS (SELECT 1 FROM profiles admin_p
      //           WHERE admin_p.id = auth.uid() AND (admin_p.admin_role IN
      //                 ('Admin/Practice Manager','Business/Practice Owner')
      //             OR 'Admin/Practice Manager' = ANY(admin_p.clinical_roles)))
      // so a non-admin calling the same code is denied by RLS. Verified against
      // production, alongside the self-update and service_role policies.
      //
      // Recording a correction: the AccountPanel entry above was justified as
      // "a read/derive of role for display", which was true of the site that
      // triggered it but incomplete — AccountPanel also contained these invite
      // writes. Splitting them into this file surfaced that, so the write now
      // carries its own reasoning instead of inheriting a partial one.
      //
      // SECOND CORRECTION (2026-08). The justification above was still too
      // generous. "Admins can update any profile" gates WHICH ROW you may
      // write, never WHICH COLUMNS — and `Users can update own profile`
      // (auth.uid() = id) let ANY authenticated user write their own
      // admin_role. PreferencesDrawer was doing exactly that, defaulting the
      // field to 'Business/Practice Owner', so saving preferences promoted you
      // to the top privilege. That is almost certainly where the 36 admins we
      // cut back to 5 came from. RLS alone never enforced this.
      //
      // Now it genuinely is enforced, by supabase/profiles_guard_authz_fields.sql:
      //   • a BEFORE INSERT OR UPDATE trigger on profiles rejects any change to
      //     admin_role / role / clinical_roles unless the caller is an admin
      //     acting on someone else (self-elevation denied even for admins), and
      //   • admin_set_user_roles(), a SECURITY DEFINER RPC that re-derives the
      //     caller's admin status server-side, is the only sanctioned door.
      // Verified against production inside a rolled-back transaction: 8/8
      // assertions, including a real non-admin self-escalation attempt.
      //
      // The remaining hit is on InviteUserDrawer.utils.js's assignUserRoles —
      // the RPC wrapper itself. The rule pattern-matches "supabase call near
      // role-ish identifiers", so it flags the very fix it recommends. There is
      // no client-side change that clears it, short of not naming the fields.
      {
        files: [
          'src/features/settings/account/InviteUserDrawer.jsx',
          'src/features/settings/account/InviteUserDrawer.utils.js',
        ],
        rules: ['react-doctor/supabase-client-owned-authz-field'],
      },

      // The iframe editor's cleanup IS total — it removes the `load` listener,
      // removes the current document's input/click listeners via
      // unsubscribeDoc(), and clears the debounce timer, all from one cleanup
      // function. The rule still fires because the setTimeout lives two
      // closures deep (effect -> handleLoad -> onInput) and the listener
      // removal is indirected through a `subscribed` record, neither of which
      // it can trace statically. Restructuring purely to flatten those
      // closures would make the teardown harder to follow, not safer.
      {
        files: ['src/features/email-builder/PreviewCanvasEditableHtml.jsx'],
        rules: ['react-doctor/effect-needs-cleanup'],
      },

      // ConfigurePanel's `form` is not derived state — it is editable state
      // hydrated ONCE from an async fetch (guarded by formLoadedRef) and then
      // owned by the user as they type. Computing it during render, which is
      // what the rule asks for, would recompute it from builderConfig on every
      // render and silently discard their edits. The two sibling hits this rule
      // reported were real and are fixed: useScheduleDrawer and
      // useChartDetailDrawer now set their derived values in the event that
      // causes them instead of chasing them from an effect.
      {
        files: ['src/features/agent-builder/ConfigurePanel.jsx'],
        rules: ['react-doctor/no-derived-state'],
      },

      // no-impure-state-updater false positives: `onTriggerEnter(recordRect)`
      // is a custom hover-delay helper, not a React state setter — the rule
      // mis-flags `recordRect`'s getBoundingClientRect as an impure updater.
      {
        files: [
          'src/features/hcc/RowPopovers.jsx',
          'src/features/hcc-archived/RowPopovers.jsx',
        ],
        rules: ['react-doctor/no-impure-state-updater'],
      },

      // effect-needs-cleanup: each of these effects DOES clean up its timers
      // and listeners, but the allocation happens inside a nested callback
      // (a setTimeout/setInterval body), which the rule's static analysis
      // can't pair with the cleanup — so it flags correct code. Verified by
      // reading each: all return a cleanup that clears every timer/listener.
      // (PopulationGroupsView's interval lives in an upload event handler,
      // not an effect, and self-clears on completion.)
      // no-fetch-response-used-without-status-check false positives:
      // SendTestPopover reads the body first ON PURPOSE (to surface the error
      // payload) and checks res.ok right after; the vite dev plugin is a
      // proxy that forwards upstream status + body verbatim.
      { files: ['src/features/email-builder/SendTestPopover.jsx', 'vite-plugin-dev-api.js'], rules: ['react-doctor/no-fetch-response-used-without-status-check'] },

      // no-fetch-in-effect: WelcomeCard's geolocation→weather lookup is a
      // self-contained widget fetch with cancellation + fallback; the repo has
      // no data-fetching layer to move it into.
      { files: ['src/features/home/WelcomeCard.jsx'], rules: ['react-doctor/no-fetch-in-effect'] },

      // no-prevent-default: PreviewCanvas renders the email's own <a> markup
      // inside the WYSIWYG canvas — clicks must select the block, never
      // navigate. Sidebar's anchor is a functioning Help toggle (semantics
      // nit). ActiveCallCard's ↗ is a decorative link styled via a
      // `.patientName a` element selector.
      {
        files: [
          'src/features/email-builder/PreviewCanvas.jsx',
          'src/components/Sidebar/Sidebar.jsx',
          'src/components/ActiveCallCard/ActiveCallCard.jsx',
        ],
        rules: ['react-doctor/no-prevent-default'],
      },

      // ResetPasswordPage deliberately KEEPS loading=true on the success path
      // so the submit button stays disabled through the 900–1200ms redirect
      // timeout (prevents a double-submit that would burn the OTP token).
      // Every failure path resets it — the reset is in a finally, just gated
      // on a `redirecting` flag, which the rule reads as conditional.
      { files: ['src/features/auth/ResetPasswordPage.jsx'], rules: ['react-doctor/no-loading-flag-reset-outside-finally'] },

      // dangerous-html-sink — the four sinks that render untrusted HTML now go
      // through src/lib/sanitizeHtml.js (DOMPurify). These remaining four are
      // deliberate and were each read before being ruled out:
      //   • InlineEditable (x2) is the email builder's contenteditable surface
      //     — the user is authoring markup for their own email, and the DOM is
      //     the editing model. Sanitizing would fight the editor.
      //   • PreviewCanvas's RawHtml block IS the "paste raw HTML" feature.
      //   • ChatPanel HTML-escapes msg.content in renderMessageMarkup() before
      //     its markdown pass, so the only tags reaching the sink are ours;
      //     the rule can't see through the helper.
      {
        files: [
          'src/features/email-builder/InlineEditable.jsx',
          'src/features/agent-builder/ChatPanel.jsx',
        ],
        rules: ['react-doctor/dangerous-html-sink'],
      },

      // iframe-missing-sandbox — verified empirically in the Browser pane
      // (2026-08): adding ANY sandbox attribute disables Chromium's built-in
      // PDF viewer. Tested blob: and data: sources against sandbox="",
      // allow-same-origin, allow-same-origin allow-scripts,
      // …allow-popups and allow-downloads allow-same-origin — the unsandboxed
      // baseline rendered, every sandboxed variant rendered blank. Sandboxing
      // these would break chart / letter / evidence document viewing, so the
      // rule is suppressed for the four document previewers rather than
      // shipping a broken clinical viewer. Sources are same-origin blob:/data:
      // URLs built by the app, not third-party content.
      {
        files: [
          'src/components/FilePreview/FilePreview.jsx',
          'src/components/PdfPreviewOverlay/PdfPreviewOverlay.jsx',
          'src/features/hcc/DiagPanel/DocEvidenceViewer.jsx',
          'src/features/patient/right-panel/tabs/care-programs/program-detail/letters/AddLetterDrawer/AddLetterDrawer.jsx',
        ],
        rules: ['react-doctor/iframe-missing-sandbox'],
      },

      // The two embed panels already carry a curated
      // sandbox="allow-scripts allow-same-origin". That pair is only an escape
      // when the frame is same-origin with the embedder; these src values are
      // always absolute cross-origin `https://${domain}${path}` built from the
      // admin-curated domain registry, so the frame gets its own origin and
      // cannot reach ours. Dropping allow-same-origin would break vendor
      // widgets that need their own storage.
      {
        files: [
          'src/features/settings/panels/ComponentLibraryPanel.jsx',
          'src/features/settings/panels/ComponentWizardDrawer.jsx',
        ],
        rules: ['react-doctor/iframe-missing-sandbox'],
      },

      // RangeSliderPopover re-seeds its slider values when reopened with a
      // different range — the standard controlled-reopen sync.
      { files: ['src/components/RangeSliderPopover/RangeSliderPopover.jsx'], rules: ['react-doctor/no-derived-state'] },

      {
        files: [
          'src/components/CreateNewPopover/CreateNewPopover.jsx',
          'src/components/HelpPopover/HelpPopover.jsx',
          'src/features/agent-builder/AgentCanvas.jsx',
          'src/features/calendar/CalendarView.jsx',
          'src/features/ccm-worklist/TimeFilterChip.jsx',
          'src/features/email-builder/PreviewCanvas.jsx',
          'src/features/hcc/DiagPanel/LeftWorkspace.jsx',
          'src/features/hcc-archived/DiagPanel/LeftWorkspace.jsx',
          'src/features/patient/shared/widgets/HealthMapWidget/HealthMapWidget.jsx',
          'src/features/population-groups/PopulationGroupsView.jsx',
          'src/features/settings/CreateAgentDrawer.jsx',
        ],
        rules: ['react-doctor/effect-needs-cleanup'],
      },
    ],
  },
};
