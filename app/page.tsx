"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";

const questions = [
  { id: 1, correct: 1 },
  { id: 2, correct: 3 },
  { id: 3, correct: 4 },
  { id: 4, correct: 3 },
  { id: 5, correct: 3 },
  { id: 6, correct: 0 },
  { id: 7, correct: 5 },
  { id: 8, correct: 5 },
  { id: 9, correct: 4 },
  { id: 10, correct: 2 },
];

const competitiveQuestions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const wrongAIQuestions = [3, 5, 7, 9];
const QUESTION_TIME_LIMIT = 90;
const aiTaunts = ["I got that one~", "Too slow!", "One step ahead~", "Gotcha~", "Mine!"];
const aiEncouragements = ["Nice one!", "Good catch.", "Well played.", "Sharp!", "You got it~"];

const QUALTRICS_RETURN_URL = "https://iu.co1.qualtrics.com/jfe/form/SV_2tvhb3IQU4w77Om";
const GOOGLE_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyG7z0zcK0LsHDvNc0B4BMx8QS1Dl9TRaHc9WA8Xj_A8DNtB6ar6IU6TEia9DwIY0di7g/exec";

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

  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const aiMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (started || showCover) return;
    const timer = setTimeout(() => {
      videoRef.current?.play();
    }, 2000);
    return () => clearTimeout(timer);
  }, [started, showCover]);
    
  useEffect(() => {
    if (!started || current >= questions.length) return;

    const interval = setInterval(() => {
      if (experimentStartTime) {
        setTotalTime(Math.floor((Date.now() - experimentStartTime) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [started, experimentStartTime, current]);

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

    return () => {
      clearAllTimers();
    };
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

    const reactionTime = 15000 + Math.random() * 5000;

    const timeout = setTimeout(() => {
      if (questionResolvedRef.current) return;

      const isWrong = wrongAIQuestions.includes(question.id);
      aiAnsweredRef.current = true;

      if (isWrong) {
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
        return;
      }
      
      aiCorrectRef.current = true;
      showAIMessage(aiTaunts[Math.floor(Math.random() * aiTaunts.length)]);
      setAiAnswerIndex(question.correct);
      setOpponentScore((prev) => prev + 1);
      setAutoAnswered(true);

      questionResolvedRef.current = true;
      inputLockedRef.current = true;

      clearTimer(countdownRef);
      commitCurrentTrial(false);
      scheduleAdvance(800);
    }, reactionTime);

    return () => clearTimeout(timeout);
  }, [current, started]);

  function postToGoogleSheet(payload: Record<string, string>) {
    return new Promise<void>((resolve, reject) => {
      const iframeName = `gs-submit-frame-${Date.now()}`;

      const iframe = document.createElement("iframe");
      iframe.name = iframeName;
      iframe.style.display = "none";

      const form = document.createElement("form");
      form.method = "POST";
      form.action = GOOGLE_APPS_SCRIPT_URL;
      form.target = iframeName;
      form.style.display = "none";

      Object.entries(payload).forEach(([key, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });

      let submitted = false;

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        form.remove();
        iframe.remove();
      };

      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error("Google Sheets submission timed out"));
      }, 15000);

      iframe.onload = () => {
        if (!submitted) return;
        cleanup();
        resolve();
      };

      document.body.appendChild(iframe);
      document.body.appendChild(form);

      submitted = true;
      form.submit();
    });
  }

  async function saveAndReturnToQualtrics() {
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setIsSubmitting(true);

    try {
      if (autoReturnTimerRef.current) {
        clearTimeout(autoReturnTimerRef.current);
        autoReturnTimerRef.current = null;
      }

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

      await postToGoogleSheet({
        rid,
        summary_json: JSON.stringify(summary),
        trials_json: JSON.stringify(trialsRef.current),
      });

      window.location.href = QUALTRICS_RETURN_URL;
    } catch (error) {
      console.error(error);
      alert("Saving data failed. Please try again.");
      saveLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!started) return;
    if (current < questions.length) return;

    autoReturnTimerRef.current = setTimeout(() => {
      void saveAndReturnToQualtrics();
    }, 2000);

    return () => {
      if (autoReturnTimerRef.current) {
        clearTimeout(autoReturnTimerRef.current);
        autoReturnTimerRef.current = null;
      }
    };
  }, [current, started]);

  function goBackToQuestionnaire() {
    void saveAndReturnToQualtrics();
  }
  
  function showAIMessage(msg: string) {
    if (aiMessageTimerRef.current) clearTimeout(aiMessageTimerRef.current);
    setAiMessage(msg);
    aiMessageTimerRef.current = setTimeout(() => setAiMessage(null), 2500);
  }
  
  function handleAnswer(index: number) {
    const question = questions[current];
    if (!question) return;
    if (questionResolvedRef.current || inputLockedRef.current) return;
    if (humanAnsweredRef.current) return;

    humanAnsweredRef.current = true;

    const rtSeconds = Math.max(0, (Date.now() - questionStartTimeRef.current) / 1000);
    const isCorrect = index === question.correct;

    setSelectedIndex(index);
    humanCorrectRef.current = isCorrect;

    updateCurrentTrialAttempt(index, rtSeconds);

    if (isCorrect) {
      setScore((prev) => prev + 1);
      setShowWrongMark(false);
      showAIMessage(aiEncouragements[Math.floor(Math.random() * aiEncouragements.length)]);

      questionResolvedRef.current = true;
      inputLockedRef.current = true;

      clearTimer(countdownRef);
      commitCurrentTrial(false);
      scheduleAdvance(1500);
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

  if (showCover) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-4xl font-bold mb-8">Pattern Reasoning Challenge</h1>

          <button
            onClick={() => {
              setShowCover(false);
              setShowStartButton(false);

              setTimeout(() => {
                setShowStartButton(true);
              }, 25000);
            }}
            className="px-10 py-4 border border-cyan-400 text-cyan-400 rounded-2xl hover:bg-cyan-400 hover:text-black transition"
          >
            BEGIN
          </button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="h-screen bg-black flex items-center justify-center px-16 gap-16">
        <div className="w-2/5 flex flex-col gap-10">
          <h1 className="text-3xl font-bold tracking-wide text-white">INSTRUCTIONS</h1>
  
          <div className="flex flex-col gap-6">
            {[
              { n: "01", text: "There will be 10 matrix reasoning problems. You will have 90 seconds for each question." },
              { n: "02", text: "You and an AI agent will answer the same questions at the same time. The first to answer correctly earns 1 point. If you answer incorrectly, you must wait for the other side to answer before both move on to the next question." },
              { n: "03", text: "The upper-left shows the question number. The upper-right shows the countdown timer and both scores." },
              { n: "04", text: "Immediate feedback is provided after each selection: a green check mark indicates correct, a red cross indicates incorrect. The AI's responses are also visible on screen." },
              { n: "05", text: "Your final score will be compared with the AI's score. Please solve as many problems as you can." },
            ].map(({ n, text }) => (
              <div key={n} className="flex gap-5 items-start">
                <span className="text-cyan-400 font-bold text-sm tracking-widest pt-0.5 w-6 shrink-0">{n}</span>
                <p className="text-gray-300 leading-relaxed text-sm">{text}</p>
              </div>
            ))}
          </div>
  
          <div className="flex flex-col items-start gap-3">
            {!showStartButton && <p className="text-gray-600 animate-pulse text-xs tracking-widest">PREPARING...</p>}
            {showStartButton && (
              <button
                onClick={() => {
                  setStarted(true);
                  setExperimentStartTime(Date.now());
                }}
                className="px-10 py-4 bg-black/80 backdrop-blur-md text-cyan-400 rounded-2xl border border-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.3)] tracking-widest text-lg hover:bg-cyan-400 hover:text-black transition-all duration-300"
              >
                READY!
              </button>
            )}
          </div>
        </div>
  
        <div className="w-3/5 flex items-center justify-center">
          <video
            ref={videoRef}
            src="/videos/rules.mp4"
            controls
            style={{ maxHeight: "75vh", maxWidth: "100%", width: "auto", height: "auto" }}
            className="rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.6)]"
          />
        </div>
      </div>
    );
  }

  if (current >= questions.length) {
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;
  
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="bg-black/70 backdrop-blur-xl border border-cyan-400 text-white rounded-3xl shadow-[0_0_40px_rgba(0,255,255,0.2)] max-w-xl px-16 py-14 text-center">
          <h1 className="text-3xl font-semibold mb-6 tracking-wide">Experiment completed.</h1>
          {score > opponentScore && (
            <div className="mb-4">
              <p className="text-5xl font-black tracking-widest text-cyan-400 drop-shadow-[0_0_20px_rgba(0,255,255,0.8)] animate-pulse">
                YOU WIN
              </p>
            </div>
          )}
          {opponentScore > score && (
            <p className="text-5xl font-black tracking-widest text-red-500 mb-4 drop-shadow-[0_0_20px_rgba(255,0,0,0.8)] animate-pulse">
              AI WINS
            </p>
          )}
          {score === opponentScore && (
            <p className="text-5xl font-black tracking-widest text-gray-400 mb-4">
              TIE
            </p>
          )}
  
          <p className="text-lg text-gray-300 mt-4">
            Total time:{" "}
            <span className="text-cyan-400 font-semibold">
              {minutes}m {seconds}s
            </span>
          </p>
  
          <p className="text-xl text-gray-300">
            Your score: <span className="text-cyan-400 font-semibold">{score}</span>
          </p>
  
          <p className="text-xl text-gray-300">
            AI&apos;s score: <span className="text-red-400 font-semibold">{opponentScore}</span>
          </p>
  
          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 text-cyan-400">
              <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-lg font-medium tracking-wide">Saving your data...</span>
            </div>
            <p className="text-sm text-gray-400">Please wait, you will be redirected automatically.</p>
          </div>
        </div>
      </div>
    );
  }

  const question = questions[current];

  return (
    <div className="h-screen flex flex-col items-center justify-center relative font-sans">
      <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl border border-cyan-400">
        <div className="text-center">
          <p className="text-xs tracking-widest text-cyan-400">QUESTION</p>
          <p className="text-2xl font-bold">
            {current + 1}
            <span className="text-sm text-gray-300 ml-2">/ {questions.length}</span>
          </p>
        </div>
      </div>

      {/* 合并后的右上角 */}
      <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl flex gap-10 items-center border border-cyan-400">
        <div className="text-center">
          <p className="text-xs tracking-widest text-cyan-400">AI'S SCORE</p>
          <p className="text-2xl font-bold text-red-400">{opponentScore}</p>
        </div>

        <div className="text-center">
          <p className="text-xs tracking-widest text-cyan-400">YOUR SCORE</p>
          <p className="text-2xl font-bold text-green-400">{score}</p>
        </div>

        <div className="text-center">
          <p className="text-xs tracking-widest text-cyan-400">TIME</p>
          <p className={`text-2xl font-bold ${timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-white"}`}>
            {timeLeft}s
          </p>
        </div>
      </div>

      <img src={`/images/q${question.id}.png`} alt="question" className="mb-6 max-w-xl" />

      {/* 强化后的选项 UI */}
      <div className="grid grid-cols-6 gap-6">
        {generateOptions(question.id).map((option, index) => (
          <div key={index} className="relative">
            <img
              src={option}
              alt="option"
              onClick={() => handleAnswer(index)}
              className={`w-24 h-24 object-contain transition duration-200
                ${
                  selectedIndex === index
                    ? "ring-4 ring-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.9)] scale-110"
                    : ""
                }
                ${
                  autoAnswered && index === aiAnswerIndex
                    ? "ring-4 ring-red-500 shadow-[0_0_20px_rgba(255,0,0,0.9)] scale-110"
                    : ""
                }
                ${
                  !selectedIndex && !(autoAnswered && index === aiAnswerIndex)
                    ? "cursor-pointer hover:scale-105"
                    : ""
                }
              `}
            />

            {selectedIndex === index && showWrongMark && (
              <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center rounded">
                <span className="text-red-500 text-5xl font-bold">✖</span>
              </div>
            )}

            {selectedIndex === index && !showWrongMark && index === question.correct && (
              <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center rounded">
                <span className="text-green-400 text-5xl font-bold">✓</span>
              </div>
            )}

            {autoAnswered && index === aiAnswerIndex && aiAnswerIndex !== question.correct && (
              <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center rounded">
                <span className="text-red-500 text-5xl font-bold">✖</span>
              </div>
            )}

            {autoAnswered && index === aiAnswerIndex && aiAnswerIndex === question.correct && (
              <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center rounded">
                <span className="text-green-400 text-5xl font-bold">✓</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {aiMessage && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/90 border border-cyan-400/40 text-cyan-400 px-6 py-3 rounded-2xl text-sm tracking-wide shadow-[0_0_20px_rgba(0,255,255,0.15)] transition-all duration-300">
          {aiMessage}
        </div>
      )}
    </div>
  );
}
