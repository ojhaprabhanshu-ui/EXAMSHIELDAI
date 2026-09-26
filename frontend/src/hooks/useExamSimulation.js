import { useState, useEffect, useCallback, useRef } from 'react';
import { SCENARIO_PRESETS, EXAM_METADATA } from '../data/mockExamData';
import { examService } from '../services/examService';

export function useExamSimulation(accessToken) {
  const [activeScenarioKey, setActiveScenarioKey] = useState('NORMAL');
  const [examState, setExamState] = useState(SCENARIO_PRESETS.NORMAL);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const transitionTimerRef = useRef(null);

  const loadState = useCallback(async (scenarioKey, token) => {
    try {
      setError(null);
      const preset = SCENARIO_PRESETS[scenarioKey] || SCENARIO_PRESETS.NORMAL;

      // Handle multi-step animation for Network Degradation (Master Demo Step 5 & 6)
      if (scenarioKey === 'NETWORK_DEGRADATION' && preset.stages && !token) {
        setIsTransitioning(true);

        setExamState({
          ...preset,
          ...preset.stages[0],
        });

        transitionTimerRef.current = setTimeout(() => {
          setExamState((prev) => ({
            ...prev,
            ...preset.stages[1],
            timeline: [...preset.timeline.slice(0, 2)],
          }));

          transitionTimerRef.current = setTimeout(() => {
            setExamState((prev) => ({
              ...prev,
              ...preset.stages[2],
              timeline: [...preset.timeline.slice(0, 3)],
            }));

            transitionTimerRef.current = setTimeout(() => {
              setExamState(preset);
              setIsTransitioning(false);
            }, 800);

          }, 800);

        }, 600);

      } else {
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
        setIsTransitioning(false);
        const data = await examService.getExamState(token);
        setExamState(data);
      }
    } catch (err) {
      console.warn('Load state warning:', err);
      setExamState(SCENARIO_PRESETS[scenarioKey] || SCENARIO_PRESETS.NORMAL);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);

    if (accessToken) {
      examService.connectLive(accessToken)
        .then((data) => {
          if (active && data) setExamState(data);
        })
        .catch(() => {
          if (active) setExamState(SCENARIO_PRESETS.NORMAL);
        });
    } else {
      examService.disconnectLive();
      loadState(activeScenarioKey, null);
    }

    const unsubscribe = examService.subscribe(() => {
      if (active) loadState(activeScenarioKey, accessToken);
    });

    return () => {
      active = false;
      unsubscribe();
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, [accessToken, activeScenarioKey, loadState]);

  const triggerScenario = useCallback((scenarioKey) => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setActiveScenarioKey(scenarioKey);
    examService.setScenario(scenarioKey);
    loadState(scenarioKey, accessToken);
  }, [accessToken, loadState]);

  const openSessionDrillDown = useCallback((sessionId) => {
    setSelectedSessionId(sessionId);
  }, []);

  const closeSessionDrillDown = useCallback(() => {
    setSelectedSessionId(null);
  }, []);

  const selectedSession = examState?.sessions?.find((s) => s.id === selectedSessionId) || null;
  const meta = examState?.examName ? { ...EXAM_METADATA, title: examState.examName, code: examState.code, semester: examState.semester } : EXAM_METADATA;

  return {
    meta,
    scenarioKey: activeScenarioKey,
    examState: examState || SCENARIO_PRESETS.NORMAL,
    isTransitioning,
    isLoading,
    error,
    selectedSession,
    selectedSessionId,
    triggerScenario,
    openSessionDrillDown,
    closeSessionDrillDown,
    isLive: examService.isLive(),
  };
}
