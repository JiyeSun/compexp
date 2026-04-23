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

export default function Home() {
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);

  const [timeLeft, setTimeLeft] = useState(30);
  const [started, setStarted] = useState(false);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isCorrectSelection, setIsCorrectSelection] = useState<boolean | null>(null);

  const [aiAnswerIndex, setAiAnswerIndex] = useState<number | null>(null);
  const [autoAnswered, setAutoAnswered] = useState(false);

  const [experimentStartTime, setExperimentStartTime] = useState<number | null>(null);
  const [totalTime, setTotalTime] = useState(0);

  const [showCover, setShowCover] = useState(true);
  const [showStartButton, setShowStartButton] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [rid] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("rid") ?? "";
  });

  const answeredOnceRef = useRef(false);
  const questionResolvedRef = useRef(false);
  const humanAnsweredRef = useRef(false);

  const questionStartTimeRef = useRef(0);
  const trialsRef = useRef<TrialRecord[]>([]);

  const timerRef = useRef<any>(null);

  function resetState() {
    setSelectedIndex(null);
    setIsCorrectSelection(null);
    setAiAnswerIndex(null);
    setAutoAnswered(false);

    answeredOnceRef.current = false;
    questionResolvedRef.current = false;
    humanAnsweredRef.current = false;
  }

  function recordTrial(choice: number | null, timeout: boolean) {
    const q = questions[current];
    const rt = Math.max(0, (Date.now() - questionStartTimeRef.current) / 1000);

    trialsRef.current.push({
      rid,
      question_number: current + 1,
      chosen_option: choice,
      correct_option: q.correct,
      rt_seconds: Number(rt.toFixed(3)),
      ended_by_timeout: timeout,
      saved_at: new Date().toISOString(),
    });
  }

  function next(delay: number) {
    setTimeout(() => {
      resetState();
      setCurrent((c) => c + 1);
    }, delay);
  }

  useEffect(() => {
    if (!started || current >= questions.length) return;

    resetState();
    setTimeLeft(30);
    questionStartTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (!questionResolvedRef.current) {
            questionResolvedRef.current = true;
            recordTrial(null, true);
            next(0);
          }
          return 30;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [current, started]);

  useEffect(() => {
    if (!started || current >= questions.length) return;

    const q = questions[current];
    if (!competitiveQuestions.includes(q.id)) return;

    const t = setTimeout(() => {
      if (questionResolvedRef.current) return;

      const wrong = wrongAIQuestions.includes(q.id);

      if (!humanAnsweredRef.current && !wrong) {
        setAiAnswerIndex(q.correct);
        setAiScore((s) => s + 1);

        questionResolvedRef.current = true;
        recordTrial(null, false);
        next(800);
        return;
      }

      if (wrong) {
        const wrongIndex = (q.correct + 1) % 6;
        setAiAnswerIndex(wrongIndex);

        if (!humanAnsweredRef.current) return;

        questionResolvedRef.current = true;
        recordTrial(selectedIndex, false);
        next(800);
        return;
      }

      setAiAnswerIndex(q.correct);
      setAiScore((s) => s + 1);

      questionResolvedRef.current = true;
      recordTrial(selectedIndex, false);
      next(800);
    }, 4000 + Math.random() * 2000);

    return () => clearTimeout(t);
  }, [current, started]);

  function handleAnswer(index: number) {
    const q = questions[current];
    if (!q) return;
    if (questionResolvedRef.current) return;
    if (answeredOnceRef.current) return;

    answeredOnceRef.current = true;
    humanAnsweredRef.current = true;

    setSelectedIndex(index);

    const correct = index === q.correct;
    setIsCorrectSelection(correct);

    if (correct) {
      setScore((s) => s + 1);
      questionResolvedRef.current = true;
      recordTrial(index, false);
      next(800);
    }
  }

  async function save() {
    setIsSubmitting(true);

    const total =
      experimentStartTime !== null
        ? Math.floor((Date.now() - experimentStartTime) / 1000)
        : totalTime;

    await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      body: new URLSearchParams({
        rid,
        summary_json: JSON.stringify({
          rid,
          total_score: score,
          ai_score: aiScore,
          total_time_seconds: total,
          n_trials: trialsRef.current.length,
          saved_at: new Date().toISOString(),
        }),
        trials_json: JSON.stringify(trialsRef.current),
      }),
    });

    window.location.href = QUALTRICS_RETURN_URL;
  }

  if (current >= questions.length) {
    return (
      <div className="h-screen flex items-center justify-center">
        <button onClick={save}>{isSubmitting ? "Saving..." : "Finish"}</button>
      </div>
    );
  }

  const q = questions[current];

  return (
    <div className="h-screen flex flex-col items-center justify-center">
      <img src={`/images/q${q.id}.png`} className="mb-6" />

      <div className="grid grid-cols-6 gap-4">
        {generateOptions(q.id).map((opt, i) => (
          <div key={i} className="relative">
            <img
              src={opt}
              onClick={() => handleAnswer(i)}
              className={`w-24 h-24
                ${selectedIndex === i ? "ring-8 ring-cyan-400" : ""}
                ${autoAnswered && aiAnswerIndex === i ? "ring-8 ring-red-600" : ""}
              `}
            />

            {/* 用户 */}
            {selectedIndex === i && (
              <div
                className={`absolute inset-0 flex items-center justify-center rounded
                  ${isCorrectSelection ? "bg-green-500/20" : "bg-red-500/20"}
                `}
              >
                {isCorrectSelection ? (
                  <span className="text-green-500 text-5xl">✓</span>
                ) : (
                  <span className="text-red-500 text-5xl">✕</span>
                )}
              </div>
            )}

            {/* AI */}
            {aiAnswerIndex === i && (
              <div
                className={`absolute inset-0 flex items-center justify-center rounded
                  ${i === q.correct ? "bg-green-500/20" : "bg-red-500/20"}
                `}
              >
                {i === q.correct ? (
                  <span className="text-green-500 text-5xl">✓</span>
                ) : (
                  <span className="text-red-500 text-5xl">✕</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
