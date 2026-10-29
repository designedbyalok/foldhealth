import { supabase } from '../../lib/supabase';
import { toast } from '../../components/Toast/sonnerToast';

const ACTIVE_REVIEW_KEY = 'fold:design-review';
const ATTACHMENT_BUCKET = 'review-attachments';

function readActiveReview() {
  try { return JSON.parse(sessionStorage.getItem(ACTIVE_REVIEW_KEY) || 'null'); } catch { return null; }
}

function rowToComment(r) {
  const points = Array.isArray(r.points) ? r.points : [];
  return {
    id: r.id,
    featureId: r.feature_id,
    authorEmail: r.author_email,
    authorName: r.author_name || r.author_email,
    body: r.body || '',
    points: points.map(p => ({
      text: p.text || '',
      html: p.html || '',
      attachments: Array.isArray(p.attachments) ? p.attachments : [],
      context: p.context || {},
    })),
    context: r.context || {},
    createdAt: r.created_at,
  };
}

const safeName = (name) => (name || 'image').replace(/[^\w.-]+/g, '-').slice(-80);

const SIGNOFF_COLUMNS = 'id, feature_id, reviewer_email, reviewer_name, assigned_by, assigned_at, signed_at, comment, commented_at, inherited_from';
// The relationship is named so the embed stays unambiguous if the signoffs
// table ever gains another reference to feature_reviews.
const COLUMNS = `id, parent_id, status, kind, decided_by, decided_at, title, description, area, link, created_by, created_at, feature_review_signoffs!feature_review_signoffs_feature_id_fkey(${SIGNOFF_COLUMNS})`;

function rowToSignoff(s) {
  return {
    id: s.id,
    featureId: s.feature_id,
    email: s.reviewer_email,
    name: s.reviewer_name,
    assignedAt: s.assigned_at,
    signedAt: s.signed_at || null,
    comment: s.comment || '',
    commentedAt: s.commented_at || null,
    // Set when the reviewer comes from the parent feature (assigned there).
    inheritedFrom: s.inherited_from || null,
  };
}

function rowToReview(r) {
  return {
    id: r.id,
    parentId: r.parent_id || null,
    // 'suggested' (from the changelog, managers only) | 'approved'.
    // Removed ('dismissed') items are never fetched.
    status: r.status || 'approved',
    kind: r.kind || 'feature',
    decidedBy: r.decided_by || '',
    decidedAt: r.decided_at || null,
    title: r.title,
    description: r.description || '',
    area: r.area || '',
    link: r.link || '',
    createdBy: r.created_by || '',
    createdAt: r.created_at,
    reviewers: (r.feature_review_signoffs || [])
      .map(rowToSignoff)
      .sort((a, b) => new Date(a.assignedAt) - new Date(b.assignedAt)),
  };
}

const signoffInsert = (featureId, reviewer, by) => ({
  feature_id: featureId,
  reviewer_email: reviewer.email.toLowerCase(),
  reviewer_name: reviewer.name,
  assigned_by: by,
});

/*
 * Feature review sign-offs (feature_reviews migration). Each feature (and
 * its sub-items) names one or more reviewers and links to the screen to
 * review; each reviewer signs off their own row from the nav bar's Reviews
 * drawer and can leave a comment. Every feat/fix commit on main arrives as a
 * 'suggested' item (changelog trigger) that the managers keep or remove.
 * RLS shows a reviewer only approved items assigned to them and lets only
 * feature_review_managers add, triage or reassign; the database stamps
 * sign-off times, so the UI only reflects what it returns.
 */
export function createFeatureReviewsSlice(set, get) {
  const patchSignoff = (signoff) => set({
    featureReviews: get().featureReviews.map(f => (f.id !== signoff.featureId ? f : {
      ...f,
      reviewers: f.reviewers.map(r => (r.id === signoff.id ? signoff : r)),
    })),
  });

  const setStatus = async (id, status) => {
    const { data, error } = await supabase
      .from('feature_reviews')
      .update({ status })
      .eq('id', id)
      .select('id, status, decided_by, decided_at')
      .single();
    if (error) {
      toast.error(error.message);
      return false;
    }
    set({
      featureReviews: get().featureReviews.map(f => (f.id !== id ? f : {
        ...f, status: data.status, decidedBy: data.decided_by || '', decidedAt: data.decided_at,
      })),
    });
    return true;
  };

  // Re-read features whose reviewer rows the database changed on its own:
  // inherited reviewers on sub-items, and a feature signed when its last
  // sub-item is.
  const refreshFeatures = async (ids) => {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return;
    const { data, error } = await supabase.from('feature_reviews').select(COLUMNS).in('id', unique);
    if (error || !data) return;
    const fresh = new Map(data.map(r => [r.id, rowToReview(r)]));
    set({ featureReviews: get().featureReviews.map(f => fresh.get(f.id) || f) });
  };
  const familyIds = (id) => {
    const all = get().featureReviews;
    const item = all.find(f => f.id === id);
    const parentId = item?.parentId || null;
    return [id, parentId, ...all.filter(f => f.parentId === id).map(f => f.id)];
  };

  return {
    featureReviews: [],
    featureReviewManagers: [],
    // Who's signed in, from the auth session (always there), so manager and
    // reviewer checks don't wait on the profile, which some pages load late.
    featureReviewsEmail: null,
    featureReviewsActor: null,

    // ── In-place review (packages/review-kit) ──
    // The item being reviewed; survives navigation within the tab.
    activeReview: readActiveReview(),
    featureReviewComments: {},

    startFeatureReview: ({ id, title, area, link }) => {
      const review = { featureId: id, title, area: area || '', link: link || '' };
      try { sessionStorage.setItem(ACTIVE_REVIEW_KEY, JSON.stringify(review)); } catch { /* private mode */ }
      set({ activeReview: review });
    },

    endFeatureReview: () => {
      try { sessionStorage.removeItem(ACTIVE_REVIEW_KEY); } catch { /* private mode */ }
      set({ activeReview: null });
    },

    // Comments with short-lived signed URLs for their attachments.
    fetchFeatureReviewComments: async (featureId) => {
      const { data, error } = await supabase
        .from('feature_review_comments')
        .select('id, feature_id, author_email, author_name, body, points, context, created_at')
        .eq('feature_id', featureId)
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('[store] review comments fetch failed:', error.message);
        return;
      }
      const comments = (data || []).map(rowToComment);
      const paths = comments.flatMap(c => c.points.flatMap(p => p.attachments.map(a => a.path))).filter(Boolean);
      if (paths.length) {
        const { data: signed } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrls(paths, 3600);
        const urlFor = new Map((signed || []).map(s => [s.path, s.signedUrl]));
        comments.forEach(c => {
          c.points = c.points.map(p => ({ ...p, attachments: p.attachments.map(a => ({ ...a, url: urlFor.get(a.path) || null })) }));
        });
      }
      set({ featureReviewComments: { ...get().featureReviewComments, [featureId]: comments } });
    },

    // One piece of feedback: a series of points, each with its own comment,
    // screenshots and page. Files upload under <featureId>/<commentId>/;
    // one that fails is skipped with a warning.
    submitFeatureReviewComment: async ({ featureId, points, context }) => {
      const commentId = crypto.randomUUID();
      const saved = [];
      for (const [pi, point] of points.entries()) {
        const attachments = [];
        for (const [ai, a] of point.attachments.entries()) {
          const path = `${featureId}/${commentId}/${pi + 1}-${ai + 1}-${safeName(a.name)}`;
          const { error } = await supabase.storage.from(ATTACHMENT_BUCKET)
            .upload(path, a.file, { contentType: a.type || a.file.type, upsert: false });
          if (error) {
            toast.error(`Couldn't upload ${a.name}: ${error.message}`);
            continue;
          }
          attachments.push({
            path, name: a.name, type: a.type || a.file.type, size: a.file.size, kind: a.kind,
            ...(a.selector ? { selector: a.selector } : {}),
            ...(a.element ? { element: a.element } : {}),
            ...(a.rect ? { rect: a.rect } : {}),
          });
        }
        if (point.text || attachments.length) {
          saved.push({ text: point.text, html: point.html || '', attachments, context: point.context });
        }
      }
      if (!saved.length) return false;
      const { error } = await supabase.from('feature_review_comments').insert({
        id: commentId,
        feature_id: featureId,
        // The database stamps the real author from the session.
        author_email: get().featureReviewsEmail || '',
        author_name: get().currentUserProfile?.name || get().featureReviewsActor,
        body: saved.length > 1 ? saved.map((p, i) => `${i + 1}. ${p.text}`).join('\n') : saved[0].text,
        points: saved,
        context,
      });
      if (error) {
        toast.error(`Couldn't save the feedback: ${error.message}`);
        return false;
      }
      get().fetchFeatureReviewComments(featureId);
      return true;
    },
    featureReviewsLoading: false,
    _featureReviewsFetched: false,

    // Once per session: the nav badge needs it, and nothing else changes
    // these rows often enough to justify a refetch or a realtime socket.
    // The nav badge loads this once per session; the drawer passes `refresh`
    // on every open, so items added since (by other managers, the changelog
    // trigger, or SQL) show up without a page reload. Only the first load
    // shows the skeleton, and a failed refresh keeps the current list.
    fetchFeatureReviews: async ({ refresh = false } = {}) => {
      const loaded = get()._featureReviewsFetched;
      if (loaded && !refresh) return;
      set({ _featureReviewsFetched: true, ...(loaded ? {} : { featureReviewsLoading: true }) });
      const [reviews, managers, session] = await Promise.all([
        supabase.from('feature_reviews').select(COLUMNS).neq('status', 'dismissed').order('created_at', { ascending: false }).limit(500),
        supabase.from('feature_review_managers').select('email, name'),
        supabase.auth.getSession(),
      ]);
      if (reviews.error) {
        console.warn('[store] feature reviews fetch failed:', reviews.error.message);
        if (loaded) { set({ featureReviewsLoading: false }); return; }
      }
      const user = session.data?.session?.user;
      const email = user?.email?.toLowerCase() || null;
      const manager = (managers.data || []).find(m => m.email.toLowerCase() === email);
      set({
        featureReviews: (reviews.data || []).map(rowToReview),
        featureReviewManagers: (managers.data || []).map(m => m.email.toLowerCase()),
        featureReviewsEmail: email,
        featureReviewsActor: manager?.name || user?.user_metadata?.full_name || null,
        featureReviewsLoading: false,
      });
    },

    addFeatureReview: async ({ title, kind, description, area, link, parentId, reviewers }) => {
      const by = get().currentUserProfile?.name || get().featureReviewsActor;
      const { data, error } = await supabase
        .from('feature_reviews')
        .insert({
          title,
          kind: kind || 'feature',
          description: description || null,
          area: area || null,
          link: link || null,
          parent_id: parentId || null,
          created_by: by,
        })
        .select('id')
        .single();
      if (error) {
        toast.error(`Couldn't add the feature: ${error.message}`);
        return null;
      }
      const { error: assignError } = await supabase
        .from('feature_review_signoffs')
        .insert(reviewers.map(r => signoffInsert(data.id, r, by)));
      if (assignError) toast.error(`Feature added, but assigning reviewers failed: ${assignError.message}`);
      const { data: full } = await supabase.from('feature_reviews').select(COLUMNS).eq('id', data.id).single();
      if (full) set({ featureReviews: [rowToReview(full), ...get().featureReviews] });
      return data.id;
    },

    // Assign, switch or remove reviewers: everyone in `reviewers` ends up
    // assigned. A reviewer who already signed stays (the database refuses
    // to remove them).
    setFeatureReviewers: async (featureId, reviewers) => {
      const feature = get().featureReviews.find(f => f.id === featureId);
      if (!feature) return false;
      const want = new Set(reviewers.map(r => r.email.toLowerCase()));
      const have = new Set(feature.reviewers.map(r => r.email.toLowerCase()));
      const removed = feature.reviewers.filter(r => !want.has(r.email.toLowerCase()) && !r.signedAt);
      const added = reviewers.filter(r => !have.has(r.email.toLowerCase()));
      const by = get().currentUserProfile?.name || get().featureReviewsActor;

      if (removed.length) {
        const { error } = await supabase.from('feature_review_signoffs').delete().in('id', removed.map(r => r.id));
        if (error) { toast.error(`Couldn't remove a reviewer: ${error.message}`); return false; }
      }
      let inserted = [];
      if (added.length) {
        const { data, error } = await supabase
          .from('feature_review_signoffs')
          .insert(added.map(r => signoffInsert(featureId, r, by)))
          .select(SIGNOFF_COLUMNS);
        if (error) { toast.error(`Couldn't assign a reviewer: ${error.message}`); return false; }
        inserted = (data || []).map(rowToSignoff);
      }
      const removedIds = new Set(removed.map(r => r.id));
      set({
        featureReviews: get().featureReviews.map(f => (f.id !== featureId ? f : {
          ...f,
          reviewers: [...f.reviewers.filter(r => !removedIds.has(r.id)), ...inserted],
        })),
      });
      // A feature's reviewers flow down to its sub-items.
      await refreshFeatures(familyIds(featureId));
      return true;
    },

    // Managers only (RLS). `fields`: { link?, area? }.
    updateFeatureReview: async (id, fields) => {
      const { error } = await supabase.from('feature_reviews').update(fields).eq('id', id);
      if (error) {
        toast.error(`Couldn't save: ${error.message}`);
        return false;
      }
      set({ featureReviews: get().featureReviews.map(f => (f.id === id ? { ...f, ...fields } : f)) });
      return true;
    },

    // Nest an item under a top-level feature, or move it back to the top level
    // (parentId null). Managers only (RLS); the database keeps it one level
    // deep. Moves at once and rolls back if the database refuses.
    moveFeatureReview: async (id, parentId, { undo = true } = {}) => {
      const item = get().featureReviews.find(f => f.id === id);
      if (!item || item.parentId === parentId) return false;
      const from = item.parentId;
      const setParent = (p) => set({
        featureReviews: get().featureReviews.map(f => (f.id === id ? { ...f, parentId: p } : f)),
      });
      setParent(parentId);
      const { error } = await supabase.from('feature_reviews').update({ parent_id: parentId }).eq('id', id);
      if (error) {
        setParent(from);
        toast.error(`Couldn't move it: ${error.message}`);
        return false;
      }
      // Moving changes which feature's reviewers it inherits.
      refreshFeatures([id]);
      if (undo) {
        const parent = get().featureReviews.find(f => f.id === parentId);
        toast(parentId ? `Nested under ${parent?.title || 'feature'}` : 'Moved to the top level', {
          action: { label: 'Undo', onClick: () => get().moveFeatureReview(id, from, { undo: false }) },
        });
      }
      return true;
    },

    // Keep a suggestion for review. The database refuses until it has a reviewer.
    keepFeatureReview: (id) => setStatus(id, 'approved'),

    // Remove a suggestion from the list. The row stays (as 'dismissed') so
    // the changelog never suggests it again; Undo puts it back.
    removeFeatureReview: async (id) => {
      const item = get().featureReviews.find(f => f.id === id);
      const ok = await setStatus(id, 'dismissed');
      if (!ok) return false;
      set({ featureReviews: get().featureReviews.filter(f => f.id !== id) });
      toast('Removed from the list', {
        action: {
          label: 'Undo',
          onClick: async () => {
            const { error } = await supabase.from('feature_reviews').update({ status: 'suggested' }).eq('id', id);
            if (error) { toast.error(error.message); return; }
            set({ featureReviews: [{ ...item, status: 'suggested' }, ...get().featureReviews] });
          },
        },
      });
      return true;
    },

    // `withSubItems`: also sign the signed-in reviewer's rows on the feature's
    // sub-items, in one request. Signing a sub-item can sign its feature
    // (database roll-up), so the family is re-read afterwards.
    signOffFeatureReview: async (signoffId, { withSubItems = false } = {}) => {
      const feature = get().featureReviews.find(f => f.reviewers.some(r => r.id === signoffId));
      if (!feature) return false;
      const mine = feature.reviewers.find(r => r.id === signoffId);
      // The trigger replaces this timestamp with the server clock.
      const stamp = { signed_at: new Date().toISOString() };
      const query = withSubItems
        ? supabase.from('feature_review_signoffs').update(stamp)
          .eq('reviewer_email', mine.email.toLowerCase())
          .in('feature_id', familyIds(feature.id).filter(id => id !== feature.parentId))
          .is('signed_at', null)
        : supabase.from('feature_review_signoffs').update(stamp).eq('id', signoffId);
      const { error } = await query.select(SIGNOFF_COLUMNS);
      if (error) {
        toast.error(`Couldn't sign off: ${error.message}`);
        return false;
      }
      await refreshFeatures(familyIds(feature.id));
      return true;
    },

    commentFeatureReview: async (signoffId, comment) => {
      const { data, error } = await supabase
        .from('feature_review_signoffs')
        .update({ comment })
        .eq('id', signoffId)
        .select(SIGNOFF_COLUMNS)
        .single();
      if (error) {
        toast.error(`Couldn't save the comment: ${error.message}`);
        return false;
      }
      patchSignoff(rowToSignoff(data));
      return true;
    },
  };
}
