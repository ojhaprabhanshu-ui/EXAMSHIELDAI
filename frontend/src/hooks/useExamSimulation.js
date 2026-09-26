import { useState, useEffect, useCallback, useRef } from 'react';
import { SCENARIO_PRESETS, EXAM_METADATA } from '../data/mockExamData';
import { examService } from '../services/examService';

export function useExamSimulation(accessToken) {
  const [activeScenarioKey, setActiveScenarioKey] = useState('NORMAL');
  const [examState, setExamState] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const transitionTimerRef = useRef(null);
  const [revision, setRevision] = useState(0);

  const loadState = useCallback(async (scenarioKey) => {
    try {
      setError(null);
      const state = await examService.getExamState();
      setExamState(state);
    } catch (err) {
      setError(err.message || 'Failed to load exam data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    setIsLoading(true);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    if (accessToken) {
      examService.connectLive(accessToken)
        .then((state) => { if (!disposed) { setExamState(state); setError(null); } })
        .catch((err) => { if (!disposed) setError(err.code ? `${err.code}: ${err.message}` : (err.message || 'Unable to connect to the backend')); })
        .finally(() => { if (!disposed) setIsLoading(false); });
    } else {
      examService.disconnectLive();
      examService.setScenario(activeScenarioKey).then(() => loadState(activeScenarioKey));
    }
    const unsubscribe = examService.subscribe(() => setRevision((value) => value + 1));
    return () => { disposed = true; unsubscribe(); if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current); };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !examService.isLive() || !revision) return;
    let disposed = false;
    examService.getExamState().then((state) => { if (!disposed) setExamState(state); })
      .catch((err) => { if (!disposed) setError(err.message); });
    return () => { disposed = true; };
  }, [accessToken, revision]);

  const triggerScenario = useCallback(async (scenarioKey) => {
    if (!SCENARIO_PRESETS[scenarioKey]) return;
    setActiveScenarioKey(scenarioKey);
    setIsTransitioning(true);
    try {
      await examService.setScenario(scenarioKey);
      if (!examService.isLive()) await loadState(scenarioKey);
    } catch (err) {
      setError(err.message || 'Unable to send telemetry');
    } finally { setIsTransitioning(false); }
  }, [loadState]);

  const openSessionDrillDown = useCallback((id) => setSelectedSessionId(id), []);
  const closeSessionDrillDown = useCallback(() => setSelectedSessionId(null), []);
  const selectedSession = examState?.sessions?.find((session) => session.id === selectedSessionId) || null;
  const meta = examState?.examName ? { ...EXAM_METADATA, title: examState.examName, code: examState.code, semester: examState.semester } : EXAM_METADATA;

  const retry = useCallback(async () => {
    setIsLoading(true);
    try {
      const state = accessToken ? await examService.connectLive(accessToken) : await examService.getExamState();
      setExamState(state); setError(null);
    } catch (err) { setError(err.message); }
    finally { setIsLoading(false); }
  }, [accessToken]);
  return { meta, scenarioKey: activeScenarioKey, examState, isTransitioning, isLoading, error, selectedSession, selectedSessionId, triggerScenario, openSessionDrillDown, closeSessionDrillDown, isLive: examService.isLive(), retry };
}
