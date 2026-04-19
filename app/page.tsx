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

const conditionId = "2"; //
const QUALTRICS_RETURN_URL = "https://iu.co1.qualtrics.com/jfe/form/SV_2tvhb3IQU4w77Om";

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
  const [progress, setProgress] = useState(0);
  const [autoAnswered, setAutoAnswered] = useState<boolean>(false);

  const [participantId, setParticipantId] = useState<string>("");

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const questionResolvedRef = useRef(false);
  const inputLockedRef = useRef(false);

  const humanAnsweredRef = useRef(false);
  const aiAnsweredRef = useRef(false);
  const humanCorrectRef = useRef(false);
  const aiCorrectRef = useRef(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("participant_id");
    if (saved) {
      setParticipantId(saved);
      return;
    }

    const id = crypto.randomUUID();
    window.localStorage.setItem("participant_id", id);
    setParticipantId(id);
  }, []);

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

  function resolveIfBothWrong(delayMs: number) {
    if (questionResolvedRef.current) return;
    if (!humanAnsweredRef.current || !aiAnsweredRef.current) return;
    if (humanCorrectRef.current || aiCorrectRef.current) return;

    questionResolvedRef.current = true;
    inputLockedRef.current = true;
    clearTimer(countdownRef);
    clearTimer(userFeedbackTimeoutRef);
    clearTimer(aiFeedbackTimeoutRef);
    scheduleAdvance(delayMs);
  }

  useEffect(() => {
    if (!started || current >= questions.length) return;

    clearAllTimers();
    resetQuestionState();
    setTimeLeft(QUESTION_TIME_LIMIT);

    countdownRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer(countdownRef);
          if (!questionResolvedRef.current) {
            questionResolvedRef.current = true;
            inputLockedRef.current = true;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      if (isWrong) {
        const wrongIndex = (question.correct + 1) % 6;
        aiCorrectRef.current = false;
        setAiAnswerIndex(wrongIndex);
        setAutoAnswered(true);

        if (humanAnsweredRef.current && !humanCorrectRef.current) {
          resolveIfBothWrong(500);
          return;
        }

        inputLockedRef.current = true;
        clearTimer(aiFeedbackTimeoutRef);
        aiFeedbackTimeoutRef.current = setTimeout(() => {
          setAutoAnswered(false);
          setAiAnswerIndex(null);
          inputLockedRef.current = false;
        }, 800);
        return;
      }

      aiCorrectRef.current = true;
      setAiAnswerIndex(question.correct);
      setOpponentScore((prev) => prev + 1);
      setAutoAnswered(true);

      questionResolvedRef.current = true;
      inputLockedRef.current = true;
      clearTimer(countdownRef);
      scheduleAdvance(800);
    }, reactionTime);

    return () => clearTimeout(timeout);
  }, [current, started]);

  useEffect(() => {
    if (!started) return;
    if (current < questions.length) return;
    if (!participantId) return;

    const timer = setTimeout(() => {
      window.location.href =
        `${QUALTRICS_RETURN_URL}` +
        `?participant_id=${encodeURIComponent(participantId)}` +
        `&condition_id=${encodeURIComponent(conditionId)}`;
    }, 2000);

    return () => clearTimeout(timer);
  }, [current, started, participantId]);

  function handleAnswer(index: number) {
    const question = questions[current];
    if (!question) return;
    if (questionResolvedRef.current || inputLockedRef.current) return;

    humanAnsweredRef.current = true;
    setSelectedIndex(index);

    const isCorrect = index === question.correct;
    humanCorrectRef.current = isCorrect;

    if (isCorrect) {
      setScore((prev) => prev + 1);
      setShowWrongMark(false);
      questionResolvedRef.current = true;
      inputLockedRef.current = true;
      clearTimer(countdownRef);
      scheduleAdvance(1500);
      return;
    }

    setShowWrongMark(true);
    inputLockedRef.current = true;

    if (aiAnsweredRef.current && !aiCorrectRef.current) {
      resolveIfBothWrong(500);
      return;
    }

    clearTimer(userFeedbackTimeoutRef);
    userFeedbackTimeoutRef.current = setTimeout(() => {
      setSelectedIndex(null);
      setShowWrongMark(false);
      inputLockedRef.current = false;
    }, 1500);
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
              setProgress(0);

              const start = Date.now();
              const interval = setInterval(() => {
                const elapsed = Date.now() - start;
                const percent = Math.min(elapsed / 2000, 1);
                setProgress(percent);

                if (percent === 1) {
                  clearInterval(interval);
                  setShowStartButton(true);
                }
              }, 16);
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
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="bg-black/70 backdrop-blur-xl border border-cyan-400 text-white rounded-3xl shadow-[0_0_40px_rgba(0,255,255,0.2)] max-w-2xl p-12 text-center">
          <div className="text-center">
            <div className="text-4xl font-bold mb-4">
              <p>RULES</p>
            </div>

            <div className="mt-6 space-y-2 text-lg text-white text-left pl-6">
              <p>
                There will be 14 matrix reasoning problems. You and an AI agent will answer the same questions
                at the same time. The first to answer correctly earns 1 point, and both of you move on to the
                next question.
              </p>
              <p>
                You will have 30 seconds per question. The upper left corner shows the question number. The
                upper right corner shows the countdown timer and both scores.
              </p>
              <p>
                A green check mark indicates a correct answer, and a red cross mark indicates an incorrect answer.
                The AI agent’s responses and feedback will also be visible on the same screen.
              </p>
              <p>Your final score will be compared with the AI’s score. Please solve as many problems as you can.</p>
            </div>

            <p className="mt-6 text-cyan-400 text-xl font-semibold"></p>
          </div>

          <p className="text-gray-600 leading-relaxed mb-8 text-lg max-w-xl mx-auto"></p>

          <div className="flex flex-col items-center justify-center mt-6">
            {!showStartButton && (
              <p className="text-gray-500 animate-pulse mb-4 text-lg tracking-wide">Preparing challenge...</p>
            )}

            {showStartButton && (
              <button
                onClick={() => {
                  setStarted(true);
                  setExperimentStartTime(Date.now());
                }}
                className="px-10 py-4 bg-black/80 backdrop-blur-md text-cyan-400 rounded-2xl border border-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.3)] tracking-widest text-lg hover:bg-cyan-400 hover:text-black hover:shadow-[0_0_25px_rgba(0,255,255,0.8)] hover:scale-105 active:scale-95 transition-all duration-600"
              >
                READY!
              </button>
            )}
          </div>
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
          <p className="text-lg text-gray-300 mt-4">
            Total time: <span className="text-cyan-400 font-semibold">
              {minutes}m {seconds}s
            </span>
          </p>
          <p className="text-xl text-gray-300">
            Your score: <span className="text-cyan-400 font-semibold">{score}</span>
          </p>
          <p className="text-xl text-gray-300">
            AI&apos;s score: <span className="text-red-400 font-semibold">{opponentScore}</span>
          </p>

          <button
            onClick={() => {
              if (!participantId) return;
              window.location.href =
                `${QUALTRICS_RETURN_URL}` +
                `?participant_id=${encodeURIComponent(participantId)}` +
                `&condition_id=${encodeURIComponent(conditionId)}`;
            }}
            className="mt-8 px-8 py-3 rounded-2xl bg-white text-black font-medium hover:bg-gray-200 transition"
          >
            Back to Questionnaire
          </button>
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

      <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl flex gap-8 items-center border border-cyan-400">
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

      <div className="absolute top-28 right-4 bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl border border-cyan-400">
        <div className="text-center">
          <p className="text-xs tracking-widest text-cyan-400">AI&apos;s Score</p>
          <p className="text-2xl font-bold text-red-400">{opponentScore}</p>
        </div>
      </div>

      <img src={`/images/q${question.id}.png`} alt="question" className="mb-6 max-w-xl" />

      <div className="grid grid-cols-6 gap-6">
        {generateOptions(question.id).map((option, index) => (
          <div key={index} className="relative">
            <img
              src={option}
              alt="option"
              onClick={() => handleAnswer(index)}
              className={`w-24 h-24 object-contain transition
                ${autoAnswered && index === aiAnswerIndex ? "ring-4 ring-red-500 scale-110" : ""}
                ${selectedIndex === index ? "ring-4 ring-cyan-400 scale-110" : "cursor-pointer hover:scale-105"}
              `}
            />

            {selectedIndex === index && showWrongMark && (
              <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center rounded">
                <span className="text-red-600 text-7xl font-bold">✕</span>
              </div>
            )}

            {selectedIndex === index && !showWrongMark && index === question.correct && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-green-500 text-6xl font-bold">✓</span>
              </div>
            )}

            {autoAnswered && index === aiAnswerIndex && aiAnswerIndex !== question.correct && (
              <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center rounded">
                <span className="text-red-600 text-7xl font-bold">✕</span>
              </div>
            )}

            {autoAnswered && index === aiAnswerIndex && aiAnswerIndex === question.correct && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-green-500 text-6xl font-bold">✓</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
