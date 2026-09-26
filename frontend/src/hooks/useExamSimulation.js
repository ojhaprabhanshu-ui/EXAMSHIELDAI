import { useState, useEffect, useCallback, useRef } from 'react';
import { SCENARIO_PRESETS, EXAM_METADATA } from '../data/mockExamData';
import { examService } from '../services/examService';

export function useExamSimulation() {
  const [activeScenarioKey, setActiveScenarioKey] = useState('NORMAL');
  const [examState, setExamState] = useState(SCENARIO_PRESETS.NORMAL);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const transitionTimerRef = useRef(null);

  // Sync state with examService updates
  const loadState = useCallback(async (scenarioKey) => {
    try {
      setIsLoading(true);
      setError(null);
      const preset = SCENARIO_PRESETS[scenarioKey] || SCENARIO_PRESETS.NORMAL;

      // Handle multi-step animation for Network Degradation (Master Demo Step 5 & 6)
      if (scenarioKey === 'NETWORK_DEGRADATION' && preset.stages) {
        setIsTransitioning(true);

        // Step 1: Normal baseline start
        setExamState({
          ...preset,
          ...preset.stages[0],
        });

        // Step 2: Transition to AT RISK (Risk 45) after 600ms
        transitionTimerRef.current = setTimeout(() => {
          setExamState((prev) => ({
            ...prev,
            ...preset.stages[1],
            timeline: [
              ...preset.timeline.slice(0, 2),
            ],
          }));

          // Step 3: Transition to AT RISK (Risk 68) after 1400ms
          transitionTimerRef.current = setTimeout(() => {
            setExamState((prev) => ({
              ...prev,
              ...preset.stages[2],
              timeline: [
                ...preset.timeline.slice(0, 3),
              ],
            }));

            // Step 4: Full CRITICAL (Risk 82) after 2200ms
            transitionTimerRef.current = setTimeout(() => {
              setExamState(preset);
              setIsTransitioning(false);
            }, 800);

          }, 800);

        }, 600);

      } else {
        // Immediate switch for other scenarios
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
        setIsTransitioning(false);
        setExamState(preset);
      }
    } catch (err) {
      setError('Failed to load telemetry state from exam service');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState(activeScenarioKey);

    const unsubscribe = examService.subscribe((newScenario) => {
      setActiveScenarioKey(newScenario);
      loadState(newScenario);
    });

    return () => {
      unsubscribe();
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, [activeScenarioKey, loadState]);

  const triggerScenario = useCallback((scenarioKey) => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setActiveScenarioKey(scenarioKey);
    examService.setScenario(scenarioKey);
  }, []);

  const openSessionDrillDown = useCallback((sessionId) => {
    setSelectedSessionId(sessionId);
  }, []);

  const closeSessionDrillDown = useCallback(() => {
    setSelectedSessionId(null);
  }, []);

  const selectedSession = examState.sessions?.find((s) => s.id === selectedSessionId) || null;

  return {
    meta: EXAM_METADATA,
    scenarioKey: activeScenarioKey,
    examState,
    isTransitioning,
    isLoading,
    error,
    selectedSession,
    selectedSessionId,
    triggerScenario,
    openSessionDrillDown,
    closeSessionDrillDown,
  };
}
