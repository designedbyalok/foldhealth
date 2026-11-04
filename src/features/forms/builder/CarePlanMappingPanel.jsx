/**
 * Care Plan tab: assessment-to-template mapping. Each rule maps a score range
 * or specific answers to care plan templates; when a patient completes the
 * form, the database suggests the mapped templates on their care plan (see
 * carePlanMappings.js).
 */
import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { CardSkeleton } from '../../../components/CardSkeleton/CardSkeleton';
import { answerFields, bandsInRange, mappingIssue, newMapping } from './carePlanMappings';
import styles from './CarePlanMappingPanel.module.css';

const KIND_OPTIONS = [
  { value: 'score', label: 'Score is in a range' },
  { value: 'answer', label: 'Answer is any of' },
];

// '' clears a bound (open-ended); anything else is a number.
const bound = (raw) => (raw === '' ? null : Number(raw));

function RuleCard({ rule, index, scores, fields, questions, templates, templateOptions, loadingTemplates, onPatch, onRemove }) {
  const score = scores.find((s) => s.id === rule.scoreId);
  const question = questions.find((f) => f.linkId === rule.linkId);
  const issue = mappingIssue(rule, { scores, fields, templates });
  const bands = rule.kind === 'score' && score ? bandsInRange(score, rule.min, rule.max) : [];

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardNum}>{index + 1}</span>
        <span className={styles.cardTitle}>When</span>
        <Select
          className={styles.kind}
          value={rule.kind}
          options={KIND_OPTIONS}
          onValueChange={(kind) => onPatch(newMapping(kind, { scores, fields }), true)}
        />
        <Button variant="ghost" size="sm" leadingIcon="solar:trash-bin-minimalistic-linear" onClick={onRemove} aria-label="Remove rule" />
      </div>

      {rule.kind === 'score' ? (
        <div className={styles.row}>
          <Select
            className={styles.grow}
            value={rule.scoreId}
            placeholder={scores.length ? 'Score' : 'No scores on this form'}
            disabled={!scores.length}
            options={scores.map((s) => ({ value: s.id, label: s.label }))}
            onValueChange={(scoreId) => onPatch({ scoreId })}
          />
          <span className={styles.word}>from</span>
          <Input className={styles.num} type="number" value={rule.min ?? ''} placeholder={score ? String(score.range?.min ?? 'min') : 'min'} onChange={(e) => onPatch({ min: bound(e.target.value) })} aria-label="Minimum score" />
          <span className={styles.word}>to</span>
          <Input className={styles.num} type="number" value={rule.max ?? ''} placeholder={score ? String(score.range?.max ?? 'max') : 'max'} onChange={(e) => onPatch({ max: bound(e.target.value) })} aria-label="Maximum score" />
        </div>
      ) : (
        <div className={styles.stack}>
          <Select
            searchable
            value={rule.linkId}
            placeholder={questions.length ? 'Question' : 'No multiple-choice questions on this form'}
            disabled={!questions.length}
            options={questions.map((f) => ({ value: f.linkId, label: f.text || f.linkId }))}
            onValueChange={(linkId) => onPatch({ linkId, values: [] })}
          />
          <Select
            multiple
            checkboxes
            badges
            value={rule.values || []}
            placeholder="Answers"
            disabled={!question}
            options={(question?.options || []).map((o) => ({ value: String(o.value), label: String(o.label || o.value) }))}
            onValueChange={(values) => onPatch({ values: values || [] })}
          />
        </div>
      )}

      {bands.length > 0 && (
        <p className={styles.hint}>
          Covers {bands.join(', ')}{score?.range ? ` (possible ${score.range.min}–${score.range.max})` : ''}
        </p>
      )}

      <div className={styles.suggest}>
        <span className={styles.word}>Suggest</span>
        <Select
          className={styles.grow}
          multiple
          checkboxes
          badges
          searchable
          portal
          value={rule.templateIds || []}
          placeholder={loadingTemplates ? 'Loading templates…' : 'Care plan templates'}
          disabled={loadingTemplates}
          options={templateOptions}
          onValueChange={(templateIds) => onPatch({ templateIds: templateIds || [] })}
        />
      </div>

      {issue && (
        <p className={styles.issue}>
          <Icon name="solar:danger-triangle-linear" size={14} color="var(--status-warning)" />
          {issue}
        </p>
      )}
    </div>
  );
}

export function CarePlanMappingPanel({ fields, scoring, onChange }) {
  const carePlanTemplates = useAppStore((s) => s.carePlanTemplates);
  const libraryLoading = useAppStore((s) => s.carePlanLibraryLoading);
  const libraryDidFetch = useAppStore((s) => s.carePlanLibraryDidFetch);
  const fetchCarePlanLibrary = useAppStore((s) => s.fetchCarePlanLibrary);
  useEffect(() => { fetchCarePlanLibrary(); }, [fetchCarePlanLibrary]);

  const scores = scoring?.scores || [];
  const mappings = scoring?.carePlanMappings || [];
  const questions = useMemo(() => answerFields(fields), [fields]);
  const templates = useMemo(
    () => (carePlanTemplates || []).filter((t) => t.status === 'published' && t.scope === 'org'),
    [carePlanTemplates],
  );
  const templateOptions = useMemo(
    () => templates.map((t) => ({ value: String(t.id), label: t.name })).toSorted((a, b) => a.label.localeCompare(b.label)),
    [templates],
  );
  const loadingTemplates = !libraryDidFetch || libraryLoading;

  const write = (next) => onChange({ ...scoring, scores, criticalTriggers: scoring?.criticalTriggers || [], carePlanMappings: next });
  const add = (kind) => write([...mappings, newMapping(kind, { scores, fields })]);
  // `replace` swaps the whole rule (kind change) but keeps its id and templates.
  const patch = (i, p, replace = false) => write(mappings.map((m, idx) => {
    if (idx !== i) return m;
    return replace ? { ...p, id: m.id, templateIds: m.templateIds || [] } : { ...m, ...p };
  }));
  const remove = (i) => write(mappings.filter((_, idx) => idx !== i));

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <h2 className={styles.title}>Care plan suggestions</h2>
          <p className={styles.lede}>
            When a patient completes this form, templates whose rule matches are suggested on their care plan as Recommended for the care manager to approve.
            A score only counts once every question in it is answered.
          </p>
        </header>

        {loadingTemplates && mappings.length > 0 && !carePlanTemplates?.length ? (
          <CardSkeleton count={Math.min(mappings.length, 3)} />
        ) : mappings.length === 0 ? (
          <div className={styles.empty}>
            <EmptyState
              icon="solar:clipboard-check-linear"
              title="No care plan rules yet"
              description={scores.length
                ? 'Map a score range or specific answers to a template, e.g. PHQ-9 score from 10 suggests Depression.'
                : 'Add a score on the Score tab, or map answers to a multiple-choice question.'}
            />
          </div>
        ) : (
          <div className={styles.list}>
            {mappings.map((m, i) => (
              <RuleCard
                key={m.id}
                rule={m}
                index={i}
                scores={scores}
                fields={fields}
                questions={questions}
                templates={templates}
                templateOptions={templateOptions}
                loadingTemplates={loadingTemplates}
                onPatch={(p, replace) => patch(i, p, replace)}
                onRemove={() => remove(i)}
              />
            ))}
          </div>
        )}

        <div className={styles.actions}>
          <Button variant="outline" size="sm" leadingIcon="solar:speedometer-middle-linear" disabled={!scores.length} onClick={() => add('score')}>Add score rule</Button>
          <Button variant="outline" size="sm" leadingIcon="solar:checklist-minimalistic-linear" disabled={!questions.length} onClick={() => add('answer')}>Add answer rule</Button>
        </div>
      </div>
    </div>
  );
}

export default CarePlanMappingPanel;
