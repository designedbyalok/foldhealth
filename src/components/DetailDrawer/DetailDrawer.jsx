import { useState, useRef, useCallback, useEffect } from 'react';
import { Drawer } from '../Drawer/Drawer';
import { useAppStore } from '../../store/useAppStore';
import { EngagementCard } from '../EngagementCard/EngagementCard';
import { GoalProgress } from '../GoalProgress/GoalProgress';
import { DetailDrawerCallCard, DetailDrawerMissedState } from './DetailDrawerCallCard';
import { DetailDrawerSummary } from './DetailDrawerSummary';
import { DetailDrawerRecording } from './DetailDrawerRecording';

export function DetailDrawer() {
  const detailPatient = useAppStore(s => s.detailPatient);
  const detailPatientCalls = useAppStore(s => s.detailPatientCalls);
  const activeCallRow = useAppStore(s => s.activeCallRow);
  const closeDetail = useAppStore(s => s.closeDetail);
  const [openSections, setOpenSections] = useState({ goals: true, summary: true, transcript: true });

  const audioRef = useRef(null);
  const [playState, setPlayState] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  const transcriptRefs = useRef({});
  const transcriptContainerRef = useRef(null);

  const startPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play();
      setPlayState('playing');
    }
  }, []);

  const pausePlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayState('paused');
    }
  }, []);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayState('idle');
      setElapsed(0);
    }
  }, []);

  const onTimeUpdate = () => {
    if (audioRef.current) setElapsed(audioRef.current.currentTime);
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const onEnded = () => {
    setPlayState('idle');
    setElapsed(0);
  };

  const handleSeek = (e) => {
    if (!audioRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    audioRef.current.currentTime = pct * duration;
    setElapsed(audioRef.current.currentTime);
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRefreshSummary = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 2000);
    }, 2000);
  };

  // Derived from the call list alone (never from detailPatient), so it can sit
  // above the early return and keep the transcript-scroll effect unconditional.
  const specificCall = activeCallRow?.id
    ? (detailPatientCalls || []).find(c => c.id === activeCallRow.id)
    : null;
  const completedCall = specificCall || (detailPatientCalls || []).find(c => c.callType === 'completed');
  const callRecord = completedCall || {};
  const goalsDetail = callRecord.goalsDetail || [];
  const callSummary = callRecord.callSummary || null;
  const callTranscript = callRecord.callTranscript || [];

  useEffect(() => {
    if (playState !== 'playing' || !openSections.transcript) return;
    const activeIdx = callTranscript.findIndex(m => elapsed >= m.start && elapsed <= m.end);
    if (activeIdx !== -1) {
      const node = transcriptRefs.current[activeIdx];
      const container = transcriptContainerRef.current;
      if (node && container) {
        const nodeTop = node.offsetTop;
        const nodeH = node.offsetHeight;
        const containerH = container.clientHeight;
        const target = nodeTop - containerH / 2 + nodeH / 2;
        container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
      }
    }
  }, [elapsed, playState, openSections.transcript, callTranscript]);

  if (!detailPatient) return null;
  const p = detailPatient;

  const callDate = activeCallRow?.date || callRecord.startedAt || p.callDate || null;
  const callDurationFull = activeCallRow?.duration || callRecord.duration || p.callDurationFull || null;
  const callDir = activeCallRow?.dir || callRecord.direction || (callRecord.callType === 'voicemail' ? 'missed' : callRecord.callType === 'declined' ? 'declined' : 'outgoing');
  const agentName = activeCallRow?.agent || callRecord.agentName || 'Anna';
  const isMissedOrDeclined = callDir === 'missed' || callDir === 'declined';

  const handleCopySummary = () => {
    if (!callSummary) return;
    const text = `Key Points Discussed:\n${callSummary.keyPoints.map(pt => `• ${pt}`).join('\n')}\n\nAction Items:\n${callSummary.actionItems.map(a => `• ${a}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const toggleSection = (key) => setOpenSections(s => ({ ...s, [key]: !s[key] }));

  return (
    <Drawer title="Call Details" onClose={closeDetail}>
      <DetailDrawerCallCard
        callDir={callDir}
        callDate={callDate}
        callDurationFull={callDurationFull}
        agentName={agentName}
        patient={p}
        detailPatientCallsCount={detailPatientCalls?.length || 0}
      />

      {isMissedOrDeclined ? (
        <DetailDrawerMissedState callDir={callDir} />
      ) : (
        <>
          {(callRecord.qualityScore || callRecord.sentimentScore || activeCallRow?.engagementScore) && (
            <EngagementCard
              engagementScore={activeCallRow?.engagementScore ?? callRecord.qualityScore?.overall ?? 0}
              sentimentScore={callRecord.sentimentScore?.overall || 0}
              sentimentLabel={callRecord.sentimentScore?.label || 'neutral'}
            />
          )}

          {goalsDetail?.length > 0 && <GoalProgress goalsDetail={goalsDetail} />}

          <DetailDrawerSummary
            open={openSections.summary}
            onToggle={() => toggleSection('summary')}
            callSummary={callSummary}
            isRefreshing={isRefreshing}
            justRefreshed={justRefreshed}
            copied={copied}
            onRefresh={handleRefreshSummary}
            onCopy={handleCopySummary}
          />

          <DetailDrawerRecording
            open={openSections.transcript}
            onToggleSection={() => toggleSection('transcript')}
            callTranscript={callTranscript}
            audioRef={audioRef}
            playState={playState}
            elapsed={elapsed}
            duration={duration}
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onLoadedMetadata}
            onEnded={onEnded}
            onSeek={handleSeek}
            startPlayback={startPlayback}
            pausePlayback={pausePlayback}
            stopPlayback={stopPlayback}
            transcriptContainerRef={transcriptContainerRef}
            transcriptRefs={transcriptRefs}
          />
        </>
      )}
    </Drawer>
  );
}
