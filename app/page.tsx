"use client";

import { useEffect, useRef, useState } from "react";

const questions = [
  { id: 1, correct: 0 },
  { id: 2, correct: 3 },
  { id: 3, correct: 4 },
  { id: 4, correct: 5 },
  { id: 5, correct: 3 },
  { id: 6, correct: 3 },
  { id: 7, correct: 0 },
  { id: 8, correct: 5 },
  { id: 9, correct: 5 },
  { id: 10, correct: 4 },
  { id: 11, correct: 2 },
  { id: 12, correct: 5 },
  { id: 13, correct: 3 },
  { id: 14, correct: 1 },
];

const competitiveQuestions = [1, 2, 3, 4, 5, 6, 9, 11];
const wrongAIQuestions = [1, 3, 4];
const QUESTION_TIME_LIMIT = 30;

const QUALTRICS_RETURN_URL = "https://iu.co1.qualtrics.com/jfe/form/SV_2tvhb3IQU4w77Om";
const GOOGLE_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCB4h577IBt9cJT9xnlU94bY4PooDHZMMUbvVPPAOnotTuoANtESXCrVgkD5UOeDa95Q/exec";

type TrialRecord = {
  rid: string;
  question_number: number;
  chosen_option: number | null;
  correct_option: number;
  rt_seconds: number;
  ended_by_timeout: boolean;
  saved_at: string;
};

type SummaryRecord = {
  rid: string;
  total_score: number;
  ai_score: number;
  total_time_seconds: number;
  n_trials: number;
  saved_at: string;
};

type TimerRef = {
  current: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval> | null;
};

function generateOptions(id: number) {
  return Array.from({ length: 6 }, (_, i) => `/images/q${id}_a${i + 1}.png`);
}

export default function Home() {
  const [current, setCurrent] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(QUESTION_TIME_LIMIT);
  const [totalTime, setTotalTime] = useState<number>(0);
  const [experimentStartTime, setExperimentStartTime] = useState<number | null>(null);
  const [started, setStarted] = useState<boolean>(false);
  const [opponentScore, setOpponentScore] = useState<number>(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showWrongMark, setShowWrongMark] = useState<boolean>(false);
  const [aiAnswerIndex, setAiAnswerIndex] = useState<number | null>(null);
  const [showCover, setShowCover] = useState(true);
  const [showStartButton, setShowStartButton] = useState(false);
  const [autoAnswered, setAutoAnswered] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [rid] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("rid") ?? "";
  });

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoReturnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const questionResolvedRef = useRef(false);
  const inputLockedRef = useRef(false);

  const humanAnsweredRef = useRef(false);
  const aiAnsweredRef = useRef(false);
  const humanCorrectRef = useRef(false);
  const aiCorrectRef = useRef(false);

  const questionStartTimeRef = useRef<number>(0);
  const trialsRef = useRef<TrialRecord[]>([]);
  const currentTrialRef = useRef<TrialRecord | null>(null);
  const currentTrialCommittedRef = useRef(false);
  const saveLockRef = useRef(false);

  function clearTimer(ref: TimerRef) {
    if (ref.current) {
      clearTimeout(ref.current as ReturnType<typeof setTimeout>);
      clearInterval(ref.current as ReturnType<typeof setInterval>);
      ref.current = null;
    }
  }

  function clearAllTimers() {
    clearTimer(countdownRef);
    clearTimer(userFeedbackTimeoutRef);
    clearTimer(aiFeedbackTimeoutRef);
    clearTimer(advanceTimeoutRef);
  }

  function resetQuestionState() {
    setSelectedIndex(null);
    setShowWrongMark(false);
    setAiAnswerIndex(null);
    setAutoAnswered(false);

    questionResolvedRef.current = false;
    inputLockedRef.current = false;
    humanAnsweredRef.current = false;
    aiAnsweredRef.current = false;
    humanCorrectRef.current = false;
    aiCorrectRef.current = false;

    currentTrialRef.current = null;
    currentTrialCommittedRef.current = false;
  }

  function initializeCurrentTrial() {
    const question = questions[current];
    currentTrialRef.current = {
      rid,
      question_number: current + 1,
      chosen_option: null,
      correct_option: question.correct,
      rt_seconds: 0,
      ended_by_timeout: false,
      saved_at: "",
    };
    currentTrialCommittedRef.current = false;
  }

  function updateCurrentTrialAttempt(index: number, rtSeconds: number) {
    if (!currentTrialRef.current) return;

    currentTrialRef.current.chosen_option = index;
    currentTrialRef.current.rt_seconds = Number(rtSeconds.toFixed(3));
    currentTrialRef.current.ended_by_timeout = false;
  }

  function commitCurrentTrial(endedByTimeout: boolean) {
    if (currentTrialCommittedRef.current) return;
    if (!currentTrialRef.current) return;

    const finalTrial: TrialRecord = {
      ...currentTrialRef.current,
      ended_by_timeout: endedByTimeout,
      saved_at: new Date().toISOString(),
    };

    trialsRef.current = [...trialsRef.current, finalTrial];
    currentTrialCommittedRef.current = true;
  }

  function advanceQuestion() {
    clearAllTimers();
    resetQuestionState();
    setCurrent((prev) => prev + 1);
  }

  function scheduleAdvance(delayMs: number) {
    clearTimer(advanceTimeoutRef);
    advanceTimeoutRef.current = setTimeout(() => {
      advanceQuestion();
    }, delayMs);
  }

  useEffect(() => {
    if (!started || current >= questions.length) return;

    clearAllTimers();
    resetQuestionState();

    setTimeLeft(QUESTION_TIME_LIMIT);
    questionStartTimeRef.current = Date.now();
    initializeCurrentTrial();

    countdownRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer(countdownRef);

          if (!questionResolvedRef.current) {
            questionResolvedRef.current = true;
            inputLockedRef.current = true;
            commitCurrentTrial(true);
            scheduleAdvance(0);
          }

          return QUESTION_TIME_LIMIT;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearAllTimers();
  }, [started, current]);

  useEffect(() => {
    if (!started || current >= questions.length) return;
    if (!experimentStartTime) return;

    const interval = setInterval(() => {
      setTotalTime(Math.floor((Date.now() - experimentStartTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [started, experimentStartTime, current]);

  useEffect(() => {
    if (!started || current >= questions.length) return;

    const question = questions[current];
    if (!question) return;
    if (!competitiveQuestions.includes(question.id)) return;

    const reactionTime = 4000 + Math.random() * 2000;

    const timeout = setTimeout(() => {
      if (questionResolvedRef.current) return;

      const isWrong = wrongAIQuestions.includes(question.id);
      aiAnsweredRef.current = true;

      if (!isWrong) {
        aiCorrectRef.current = true;
        setAiAnswerIndex(question.correct);
        setOpponentScore((prev) => prev + 1);
        setAutoAnswered(true);

        questionResolvedRef.current = true;
        inputLockedRef.current = true;

        clearTimer(countdownRef);
        commitCurrentTrial(false);
        scheduleAdvance(800);
        return;
      }

      const wrongIndex = (question.correct + 1) % 6;
      aiCorrectRef.current = false;
      setAiAnswerIndex(wrongIndex);
      setAutoAnswered(true);

      if (humanAnsweredRef.current) {
        questionResolvedRef.current = true;
        inputLockedRef.current = true;

        clearTimer(countdownRef);
        commitCurrentTrial(false);
        scheduleAdvance(800);
        return;
      }

      inputLockedRef.current = false;

      clearTimer(aiFeedbackTimeoutRef);
      aiFeedbackTimeoutRef.current = setTimeout(() => {
        setAutoAnswered(false);
        setAiAnswerIndex(null);
      }, 800);
    }, reactionTime);

    return () => clearTimeout(timeout);
  }, [current, started]);

  function handleAnswer(index: number) {
    const question = questions[current];
    if (!question) return;
    if (questionResolvedRef.current || inputLockedRef.current) return;

    humanAnsweredRef.current = true;

    const rtSeconds = Math.max(0, (Date.now() - questionStartTimeRef.current) / 1000);
    const isCorrect = index === question.correct;

    setSelectedIndex(index);
    humanCorrectRef.current = isCorrect;

    updateCurrentTrialAttempt(index, rtSeconds);

    if (isCorrect) {
      setScore((prev) => prev + 1);

      questionResolvedRef.current = true;
      inputLockedRef.current = true;

      clearTimer(countdownRef);
      commitCurrentTrial(false);
      scheduleAdvance(800);
      return;
    }

    setShowWrongMark(true);
    inputLockedRef.current = true;

    if (aiAnsweredRef.current) {
      questionResolvedRef.current = true;

      clearTimer(countdownRef);
      commitCurrentTrial(false);
      scheduleAdvance(800);
      return;
    }
  }

  async function saveAndReturnToQualtrics() {
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setIsSubmitting(true);

    const finalTotalTime =
      experimentStartTime !== null
        ? Math.floor((Date.now() - experimentStartTime) / 1000)
        : totalTime;

    const summary: SummaryRecord = {
      rid,
      total_score: score,
      ai_score: opponentScore,
      total_time_seconds: finalTotalTime,
      n_trials: trialsRef.current.length,
      saved_at: new Date().toISOString(),
    };

    await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      body: new URLSearchParams({
        rid,
        summary_json: JSON.stringify(summary),
        trials_json: JSON.stringify(trialsRef.current),
      }),
    });

    window.location.href = QUALTRICS_RETURN_URL;
  }

  return <div />; 
}
