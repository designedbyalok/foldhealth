import { supabase } from '../../lib/supabase';
import { toast } from '../../components/Toast/sonnerToast';

const SIGNOFF_COLUMNS = 'id, feature_id, reviewer_email, reviewer_name, assigned_by, assigned_at, signed_at, comment, commented_at';
const COLUMNS = `id, parent_id, status, kind, decided_by, decided_at, title, description, area, link, created_by, created_at, feature_review_signoffs(${SIGNOFF_COLUMNS})`;

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

  return {
    featureReviews: [],
    featureReviewManagers: [],
    featureReviewsLoading: false,
    _featureReviewsFetched: false,

    // Once per session: the nav badge needs it, and nothing else changes
    // these rows often enough to justify a refetch or a realtime socket.
    fetchFeatureReviews: async () => {
      if (get()._featureReviewsFetched) return;
      set({ _featureReviewsFetched: true, featureReviewsLoading: true });
      const [reviews, managers] = await Promise.all([
        supabase.from('feature_reviews').select(COLUMNS).neq('status', 'dismissed').order('created_at', { ascending: false }).limit(500),
        supabase.from('feature_review_managers').select('email'),
      ]);
      if (reviews.error) console.warn('[store] feature reviews fetch failed:', reviews.error.message);
      set({
        featureReviews: (reviews.data || []).map(rowToReview),
        featureReviewManagers: (managers.data || []).map(m => m.email.toLowerCase()),
        featureReviewsLoading: false,
      });
    },

    addFeatureReview: async ({ title, kind, description, area, link, parentId, reviewers }) => {
      const by = get().currentUserProfile?.name || null;
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
      const by = get().currentUserProfile?.name || null;

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

    signOffFeatureReview: async (signoffId) => {
      const { data, error } = await supabase
        .from('feature_review_signoffs')
        // The trigger replaces this timestamp with the server clock.
        .update({ signed_at: new Date().toISOString() })
        .eq('id', signoffId)
        .select(SIGNOFF_COLUMNS)
        .single();
      if (error) {
        toast.error(`Couldn't sign off: ${error.message}`);
        return false;
      }
      patchSignoff(rowToSignoff(data));
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
