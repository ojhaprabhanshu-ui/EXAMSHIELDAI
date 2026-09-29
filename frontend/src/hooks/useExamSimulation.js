import { useState, useEffect, useCallback, useRef } from 'react';
import { EXAM_METADATA } from '../data/mockExamData';
import { examService } from '../services/examService';
import { demoTelemetryService } from '../services/demoTelemetryService';

export function useExamSimulation(accessToken) {
  const [activeScenarioKey, setActiveScenarioKey] = useState('NORMAL');
  const [examState, setExamState] = useState(() => accessToken ? null : demoTelemetryService.getState());
  const [isLoading, setIsLoading] = useState(Boolean(accessToken));
  const [error, setError] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const scenarioTargetSessionRef = useRef(null);

  const loadLiveState = useCallback(async (token) => {
    try {
      const data = await examService.getExamState(token);
      setExamState(data);
      setError(null);
      setIsLive(examService.isLive());
      return data;
    } catch (err) {
      setIsLive(false);
      setError(err.message || 'Could not load live exam state from the backend.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (accessToken) {
      setIsLoading(true);
      const unsubscribe = examService.subscribe((_scenario, state) => {
        if (!active) return;
        setIsLive(examService.isLive());
        if (state) setExamState(state);
        else void loadLiveState(accessToken).catch(() => {});
      });
      void examService.connectLive(accessToken)
        .then((state) => {
          if (active && state) { setExamState(state); setIsLive(examService.isLive()); setError(null); }
        })
        .catch((err) => {
          if (active) { setIsLive(false); setError(err.message || 'Could not load live exam state from the backend.'); }
        })
        .finally(() => { if (active) setIsLoading(false); });
      return () => { active = false; unsubscribe(); };
    }

    examService.disconnectLive();
    setIsLoading(false);
    setIsLive(false);
    setError(null);
    const update = (state) => {
      if (!active) return;
      setExamState(state);
      setActiveScenarioKey(state.activeScenario);
    };
    update(demoTelemetryService.getState());
    const unsubscribe = demoTelemetryService.subscribe(update);
    return () => { active = false; unsubscribe(); };
  }, [accessToken, loadLiveState]);

  const triggerScenario = useCallback((scenarioKey) => {
    setActiveScenarioKey(scenarioKey);
    if (scenarioKey === 'NORMAL') {
      setSelectedSessionId(null);
      scenarioTargetSessionRef.current = null;
    }
    if (accessToken) {
      return examService.simulateScenario(scenarioKey, selectedSessionId || scenarioTargetSessionRef.current)
        .then(async (report) => { await loadLiveState(accessToken); return report; })
        .catch((err) => { setError(err.message); throw err; });
    }
    return Promise.resolve(demoTelemetryService.setScenario(scenarioKey));
  }, [accessToken, loadLiveState, selectedSessionId]);

  const retry = useCallback(() => accessToken ? loadLiveState(accessToken) : Promise.resolve(demoTelemetryService.getState()), [accessToken, loadLiveState]);
  const openSessionDrillDown = useCallback((sessionId) => {
    scenarioTargetSessionRef.current = sessionId;
    setSelectedSessionId(sessionId);
  }, []);
  const closeSessionDrillDown = useCallback(() => setSelectedSessionId(null), []);

  const sessions = examState?.sessions || [];
  const selectedSession = sessions.find((session) => String(session.id) === String(selectedSessionId)) || null;
  const meta = examState?.examName
    ? { ...EXAM_METADATA, title: examState.examName, code: examState.code, semester: examState.semester }
    : EXAM_METADATA;

  return {
    meta,
    scenarioKey: activeScenarioKey,
    examState,
    isTransitioning: false,
    isLoading,
    error,
    selectedSession,
    selectedSessionId,
    scenarioTargetSessionId: selectedSessionId || scenarioTargetSessionRef.current || sessions[0]?.id || null,
    triggerScenario,
    resetScenario: () => triggerScenario('NORMAL'),
    retry,
    openSessionDrillDown,
    closeSessionDrillDown,
    isLive,
  };
}
