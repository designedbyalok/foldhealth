import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Drawer } from '@/components/Drawer/Drawer';
import { CardSkeleton } from '@/components/CardSkeleton/CardSkeleton';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { FormRenderer } from '@/features/forms/render/FormRenderer';
import { evaluate } from '@/features/forms/scoring/evaluate';
import { toQuestionnaire } from '@/features/forms/builder/engineAdapter';

// Fills a form the care team sent, with the same renderer and scoring as the
// staff app's form view; the response is saved against this patient.
export function FormFillDrawer({ memberId, send, onClose, onSubmitted }) {
  const [form, setForm] = useState(undefined);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.rpc('patient_form', { p_member_id: memberId, p_send_id: send.send_id }).then(({ data }) => {
      if (alive) setForm(data?.[0] || null);
    });
    return () => { alive = false; };
  }, [memberId, send.send_id]);

  const submit = async () => {
    const items = form.schema?.items || [];
    let scores = {};
    try {
      const result = evaluate(
        { questionnaire: toQuestionnaire(items), scores: form.scoring?.scores || [], criticalTriggers: form.scoring?.criticalTriggers || [] },
        answers,
      );
      scores = { scores: result.scores, criticalsTriggered: result.criticalsTriggered };
    } catch { /* submit answers even if scoring fails */ }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('patient_submit_form', {
        p_member_id: memberId, p_send_id: send.send_id, p_answers: answers, p_scores: scores,
      });
      if (error) {
        toast.error(error.message || 'Your answers were not sent. Try again.');
        return false;
      }
      toast.success(`${form.name} sent to your care team`);
      onSubmitted();
      setDismissed(true);
      return true;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer title={send.name} onClose={onClose} dismissed={dismissed} width={640}>
      {form === undefined && <CardSkeleton count={3} />}
      {form === null && (
        <EmptyState icon="solar:clipboard-text-linear" title="This form is not available" description="Ask your care team to send it again." />
      )}
      {form && (
        <FormRenderer
          fields={form.schema?.items || []}
          settings={{ ...form.settings, layout: 'entire-page' }}
          scoring={form.scoring}
          formName={form.name}
          formDescription={form.description}
          answers={answers}
          onAnswer={(linkId, v) => setAnswers((prev) => ({ ...prev, [linkId]: v }))}
          onSubmit={submit}
          submitting={submitting}
          scope="standalone"
          onValidationFail={(n) => toast.error(`Please answer ${n} required question${n === 1 ? '' : 's'}`)}
        />
      )}
    </Drawer>
  );
}
