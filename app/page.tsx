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
  "https://script.google.com/macros/s/AKfycbyEb4x2mOslt3fDEO3xGTub5CVE8FoyIGxXpaYeqROnf8eKO7C-Ml9Ibyo_yw9JQhUBgA/exec";

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

export default function Home() {
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT);
  const [totalTime, setTotalTime] = useState(0);
  const [experimentStartTime, setExperimentStartTime] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [opponentScore, setOpponentScore] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showWrongMark, setShowWrongMark] = useState(false);
  const [aiAnswerIndex, setAiAnswerIndex] = useState<number | null>(null);
  const [autoAnswered, setAutoAnswered] = useState(false);

  const [rid] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("rid") ?? "";
  });

  const countdownRef = useRef<any>(null);
  const questionResolvedRef = useRef(false);
  const inputLockedRef = useRef(false);

  const humanAnsweredRef = useRef(false);
  const aiAnsweredRef = useRef(false);

  const questionStartTimeRef = useRef(0);
  const trialsRef = useRef<TrialRecord[]>([]);
  const currentTrialRef = useRef<TrialRecord | null>(null);

  function resetQuestion() {
    setSelectedIndex(null);
    setShowWrongMark(false);
    setAiAnswerIndex(null);
    setAutoAnswered(false);

    questionResolvedRef.current = false;
    inputLockedRef.current = false;
    humanAnsweredRef.current = false;
    aiAnsweredRef.current = false;
  }

  function startTrial() {
    const q = questions[current];
    currentTrialRef.current = {
      rid,
      question_number: current + 1,
      chosen_option: null,
      correct_option: q.correct,
      rt_seconds: 0,
      ended_by_timeout: false,
      saved_at: "",
    };
  }

  function commitTrial(timeout: boolean) {
    if (!currentTrialRef.current) return;
    trialsRef.current.push({
      ...currentTrialRef.current,
      ended_by_timeout: timeout,
      saved_at: new Date().toISOString(),
    });
  }

  function next() {
    clearInterval(countdownRef.current);
    resetQuestion();
    setCurrent((c) => c + 1);
  }

  useEffect(() => {
    if (!started || current >= questions.length) return;

    resetQuestion();
    startTrial();
    setTimeLeft(QUESTION_TIME_LIMIT);
    questionStartTimeRef.current = Date.now();

    countdownRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(countdownRef.current);
          commitTrial(true);
          next();
          return QUESTION_TIME_LIMIT;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(countdownRef.current);
  }, [current, started]);

  // AI
  useEffect(() => {
    if (!started || current >= questions.length) return;

    const q = questions[current];
    if (!competitiveQuestions.includes(q.id)) return;

    const t = setTimeout(() => {
      if (questionResolvedRef.current) return;

      aiAnsweredRef.current = true;

      const isWrong = wrongAIQuestions.includes(q.id);

      if (isWrong) {
        const wrong = (q.correct + 1) % 6;
        setAiAnswerIndex(wrong);
        setAutoAnswered(true);

        if (humanAnsweredRef.current) {
          questionResolvedRef.current = true;
          commitTrial(false);
          setTimeout(next, 800);
          return;
        }

        inputLockedRef.current = false;

        setTimeout(() => {
          setAutoAnswered(false);
          setAiAnswerIndex(null);
        }, 800);

        return;
      }

      // AI correct
      setAiAnswerIndex(q.correct);
      setOpponentScore((s) => s + 1);
      setAutoAnswered(true);

      questionResolvedRef.current = true;
      inputLockedRef.current = true;

      commitTrial(false);
      setTimeout(next, 800);
    }, 4000 + Math.random() * 2000);

    return () => clearTimeout(t);
  }, [current, started]);

  function handleAnswer(index: number) {
    const q = questions[current];
    if (questionResolvedRef.current || inputLockedRef.current) return;

    humanAnsweredRef.current = true;

    const rt = (Date.now() - questionStartTimeRef.current) / 1000;
    const correct = index === q.correct;

    setSelectedIndex(index);

    if (currentTrialRef.current) {
      currentTrialRef.current.chosen_option = index;
      currentTrialRef.current.rt_seconds = Number(rt.toFixed(3));
    }

    if (correct) {
      setScore((s) => s + 1);
      questionResolvedRef.current = true;
      inputLockedRef.current = true;

      commitTrial(false);
      setTimeout(next, 800);
      return;
    }

    // ❌ 用户答错 → 锁死
    setShowWrongMark(true);
    inputLockedRef.current = true;

    // AI已经答过 → 直接结束
    if (aiAnsweredRef.current) {
      questionResolvedRef.current = true;
      commitTrial(false);
      setTimeout(next, 800);
    }
  }

  // 完成
  useEffect(() => {
    if (!started || current < questions.length) return;

    const summary: SummaryRecord = {
      rid,
      total_score: score,
      ai_score: opponentScore,
      total_time_seconds: totalTime,
      n_trials: trialsRef.current.length,
      saved_at: new Date().toISOString(),
    };

    console.log(summary);
  }, [current]);

  if (!started) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white">
        <button
          onClick={() => {
            setStarted(true);
            setExperimentStartTime(Date.now());
          }}
        >
          START
        </button>
      </div>
    );
  }

  if (current >= questions.length) {
    return (
      <div className="h-screen flex items-center justify-center text-white bg-black">
        Done
      </div>
    );
  }

  const q = questions[current];

  return (
    <div className="h-screen flex flex-col items-center justify-center text-white bg-black">
      <h1>{current + 1}</h1>
      <p>{timeLeft}s</p>

      <img src={`/images/q${q.id}.png`} className="mb-6" />

      <div className="grid grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <img
            key={i}
            src={`/images/q${q.id}_a${i + 1}.png`}
            onClick={() => handleAnswer(i)}
            className="w-24 cursor-pointer"
          />
        ))}
      </div>
    </div>
  );
}
