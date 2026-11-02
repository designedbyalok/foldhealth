import { useState } from 'react';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { templateItems } from '../../../../../../../store/lib/carePlanStoreLib';
import { episodeOf } from '../lib/episodeTemplates';
import { programUrlKey } from '../../CareProgramsTab/CareProgramsTab.utils';
import { flatSteps, stepsFor } from '../../program-detail/ProgramDetailView/ProgramDetailView.utils';
import { instanceOutcome } from '../lib/templateRenewal';
import { EndEpisodeDialog, EpisodeBanner, ExtendEpisodeDialog } from './EpisodeBanner';
import { StartEpisodeDialog } from './StartEpisodeDialog';

/**
 * Episodes on a care plan (lib/episodeTemplates). `interceptApply` takes the
 * Apply Templates selection first: when it adds an episodic template, the
 * Start Episode dialog confirms each one's last day and the plans it pauses
 * before anything is applied (Cancel applies nothing). `banners` shows each
 * running episode with Extend / End Episode; `dialogs` renders the dialogs.
 */
export function useCarePlanEpisodes({ patientId, program, live, canEdit, readOnly, applyTemplates }) {
  const carePlanTemplates = useAppStore(s => s.carePlanTemplates);
  const libraryGoals = useAppStore(s => s.carePlanGoals);
  const startCarePlanEpisode = useAppStore(s => s.startCarePlanEpisode);
  const startEpisodeProgram = useAppStore(s => s.startEpisodeProgram);
  const openCareProgram = useAppStore(s => s.openCareProgram);
  const setCareProgramStep = useAppStore(s => s.setCareProgramStep);
  const extendCarePlanEpisode = useAppStore(s => s.extendCarePlanEpisode);
  const endCarePlanEpisode = useAppStore(s => s.endCarePlanEpisode);
  const showToast = useAppStore(s => s.showToast);
  // { ids, priorities, categoryPicks, queue: [episodic templates being added], index, choices }
  const [pending, setPending] = useState(null);
  const [extendRun, setExtendRun] = useState(null);
  const [endRun, setEndRun] = useState(null);

  const running = (live?.templateInstances || []).filter(i => i.episodic && i.status === 'active');

  const interceptApply = (ids, priorities, categoryPicks) => {
    const already = new Set((live?.plan?.appliedTemplateIds || []).map(String));
    const queue = ids
      .filter(id => !already.has(String(id)))
      .map(id => carePlanTemplates.find(t => String(t.id) === String(id)))
      .filter(t => episodeOf(t));
    if (!queue.length) return false;
    setPending({ ids, priorities, categoryPicks, queue, index: 0, choices: [] });
    return true;
  };

  const confirmStart = async (choice) => {
    const p = pending;
    const choices = [...p.choices, { template: p.queue[p.index], ...choice }];
    if (p.index + 1 < p.queue.length) {
      setPending({ ...p, index: p.index + 1, choices });
      return;
    }
    setPending(null);
    // An episode with its own program starts there rather than on this plan.
    const ownProgram = c => { const code = episodeOf(c.template)?.programCode; return !!code && code !== program.code; };
    const elsewhere = new Set(choices.filter(ownProgram).map(c => String(c.template.id)));
    const here = p.ids.filter(id => !elsewhere.has(String(id)));
    const already = (live?.plan?.appliedTemplateIds || []).map(String);
    if (here.length !== already.length || here.some(id => !already.includes(String(id)))) {
      const ok = await applyTemplates(here, p.priorities, p.categoryPicks);
      if (ok === false) return;
    }
    let opened = null;
    for (const c of choices) {
      // One at a time: each pauses plans and writes the same patient's rows.
      const args = { endsOn: c.endsOn, pausePlans: c.pausePlans };
      if (ownProgram(c)) {
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        opened = (await startEpisodeProgram(patientId, c.template, args)) || opened;
      } else {
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await startCarePlanEpisode(patientId, program, c.template.id, args);
      }
    }
    // Land on the episode's own care plan.
    if (opened) {
      const step = flatSteps(stepsFor(opened.code)).find(st => st.name === 'Care Plan');
      openCareProgram(programUrlKey(opened));
      if (step) setCareProgramStep(step.id);
    }
    const paused = choices.reduce((n, c) => n + c.pausePlans.length, 0);
    showToast(choices.length === 1
      ? `"${choices[0].template.name}" episode started${paused ? `. ${paused} other care plan${paused === 1 ? '' : 's'} paused` : ''}`
      : `${choices.length} episodes started`);
  };

  const endOutcome = (run) => {
    const template = carePlanTemplates.find(t => String(t.id) === String(run.templateId));
    return template && live ? instanceOutcome(templateItems(template, live, libraryGoals || [])) : null;
  };

  const banners = readOnly ? null : running.map(run => (
    <EpisodeBanner
      key={run.id}
      run={run}
      canEdit={canEdit}
      onExtend={() => setExtendRun(run)}
      onEnd={() => setEndRun(run)}
    />
  ));

  const current = pending?.queue[pending.index];
  const dialogs = (
    <>
      {current && (
        <StartEpisodeDialog
          key={current.id}
          template={current}
          patientId={patientId}
          program={program}
          step={pending.index + 1}
          steps={pending.queue.length}
          onCancel={() => setPending(null)}
          onConfirm={confirmStart}
        />
      )}
      {extendRun && (
        <ExtendEpisodeDialog
          run={extendRun}
          onCancel={() => setExtendRun(null)}
          onConfirm={async (endsOn) => {
            await extendCarePlanEpisode(patientId, program, extendRun.id, endsOn);
            setExtendRun(null);
          }}
        />
      )}
      {endRun && (
        <EndEpisodeDialog
          run={endRun}
          outcome={endOutcome(endRun)}
          onCancel={() => setEndRun(null)}
          onConfirm={async () => {
            await endCarePlanEpisode(patientId, program, endRun.id, { reason: 'ended_early' });
            setEndRun(null);
          }}
        />
      )}
    </>
  );

  return { interceptApply, banners, dialogs };
}
