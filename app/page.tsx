"use client";
import { useState, useEffect } from "react";

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
  { id: 14, correct: 1 }
];

export default function Home() {
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [totalTime, setTotalTime] = useState(0);
  const [experimentStartTime, setExperimentStartTime] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [opponentScore, setOpponentScore] = useState(0);
  const [autoAnswered, setAutoAnswered] = useState(false);
  const competitiveQuestions = [1,2,3,4,5,6,9,11];
  const wrongAIQuestions = [1,3,4];

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showWrongMark, setShowWrongMark] = useState(false);
  const [aiAnswerIndex, setAiAnswerIndex] = useState<number | null>(null);

  // total time
  useEffect(() => {
    if (!started || current >= questions.length) return;

    const interval = setInterval(() => {
      if (experimentStartTime) {
        setTotalTime(Math.floor((Date.now() - experimentStartTime) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [started, experimentStartTime, current]);

  // countdown
  useEffect(() => {
    if (!started) return;

    setTimeLeft(30);

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setCurrent(prevQ => prevQ + 1);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [current, started]);

  // AI behavior
  useEffect(() => {
    if (!started || current >= questions.length) return;

    const questionNumber = questions[current].id;

    if (!competitiveQuestions.includes(questionNumber)) {
      setAutoAnswered(false);
      return;
    }

    setAutoAnswered(false);

    const reactionTime = 4000 + Math.random() * 2000;

    const timeout = setTimeout(() => {
      const isWrong = wrongAIQuestions.includes(questionNumber);

      if (isWrong) {
        const wrongIndex = (questions[current].correct + 1) % 6;
        setAiAnswerIndex(wrongIndex);
        setAutoAnswered(true);

        // allow retry
        setTimeout(() => {
          setAutoAnswered(false);
          setAiAnswerIndex(null);
        }, 800);

      } else {
        setAiAnswerIndex(questions[current].correct);
        setOpponentScore(prev => prev + 1);
        setAutoAnswered(true);

        setTimeout(() => {
          setCurrent(prev => prev + 1);
        }, 800);
      }
    }, reactionTime);

    return () => clearTimeout(timeout);
  }, [current, started]);

  function handleAnswer(index: number) {
    if (autoAnswered && aiAnswerIndex === questions[current].correct) return;

    setSelectedIndex(index);

    const isCorrect = index === questions[current].correct;

    if (isCorrect) {
      setScore(prev => prev + 1);
    } else {
      setShowWrongMark(true);
    }

    setTimeout(() => {
      setSelectedIndex(null);
      setShowWrongMark(false);

      if (isCorrect) {
        setCurrent(prev => prev + 1);
      }
    }, 1500);
  }

  function generateOptions(id: number) {
    return Array.from({ length: 6 }, (_, i) =>
      `/images/q${id}_a${i + 1}.png`
    );
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-black text-white font-sans flex items-center justify-center">
        <button
          onClick={() => {
            setStarted(true);
            setExperimentStartTime(Date.now());
          }}
          className="px-10 py-4 border border-cyan-400 text-cyan-400 rounded-xl"
        >
          BEGIN
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white font-sans flex flex-col items-center justify-center">

      <img
        src={`/images/q${questions[current].id}.png`}
        className="mb-6 max-w-xl"
      />

      <div className="grid grid-cols-6 gap-6">
        {generateOptions(questions[current].id).map((option, index) => (
          <div key={index} className="relative">

            <img
              src={option}
              onClick={() => handleAnswer(index)}
              className={`w-24 h-24 object-contain
                ${autoAnswered && index === aiAnswerIndex ? "ring-4 ring-red-500" : ""}
                ${selectedIndex === index ? "ring-4 ring-cyan-400" : ""}
              `}
            />

            {/* Human wrong */}
            {selectedIndex === index && showWrongMark && (
              <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                ✕
              </div>
            )}

            {/* Human correct */}
            {selectedIndex === index && !showWrongMark && index === questions[current].correct && (
              <div className="absolute inset-0 flex items-center justify-center text-green-500 text-5xl">
                ✓
              </div>
            )}

            {/* AI wrong */}
            {autoAnswered && index === aiAnswerIndex && aiAnswerIndex !== questions[current].correct && (
              <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                ✕
              </div>
            )}

            {/* AI correct */}
            {autoAnswered && index === aiAnswerIndex && aiAnswerIndex === questions[current].correct && (
              <div className="absolute inset-0 flex items-center justify-center text-green-500 text-5xl">
                ✓
              </div>
            )}

          </div>
        ))}
      </div>
    </div>
  );
}
