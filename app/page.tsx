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
  const [current, setCurrent] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [totalTime, setTotalTime] = useState<number>(0);
  const [experimentStartTime, setExperimentStartTime] = useState<number | null>(null);
  const [started, setStarted] = useState<boolean>(false);
  const [opponentScore, setOpponentScore] = useState<number>(0);
  const [autoAnswered, setAutoAnswered] = useState<boolean>(false);
  const competitiveQuestions = [2,5,6,9,11];
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showWrongMark, setShowWrongMark] = useState<boolean>(false);


  useEffect(() => {
  if (!started || current >= questions.length) return;

  const interval = setInterval(() => {
    if (experimentStartTime) {
      setTotalTime(Math.floor((Date.now() - experimentStartTime) / 1000));
    }
  }, 1000);

  return () => clearInterval(interval);
}, [started, experimentStartTime, current]);

  useEffect(() => {
  if (!started) return;

  setTimeLeft(30);

  const timer = setInterval(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) {
        clearInterval(timer);

        if (current >= questions.length - 1) {
          setCurrent(questions.length);
        } else {
          setCurrent((prevQ) => prevQ + 1);
        }

        return 30;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(timer);
}, [current, started]);
  
  useEffect(() => {
    if (!started) return;
    if (current >= questions.length) return;
  
    const questionNumber = questions[current].id;
  
    if (!competitiveQuestions.includes(questionNumber)) {
      setAutoAnswered(false);
      return;
    }
  
    setAutoAnswered(false);
  
    const reactionTime = 800 + Math.random() * 800;
  
    const timeout = setTimeout(() => {
      setOpponentScore(prev => prev + 1);
      setAutoAnswered(true);
  
      setTimeout(() => {
        setCurrent(prev => prev + 1);
      }, 1500);
  
    }, reactionTime);

    return () => clearTimeout(timeout);

  }, [current, started]);

  function generateOptions(id: number) {
    return Array.from({ length: 6 }, (_, i) => 
      `/images/q${id}_a${i + 1}.png`
    );
  }

  function handleAnswer(index: number) {
  if (autoAnswered) return;

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
    setCurrent(prev => prev + 1);
  }, 1500);
}

  if (!started) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">

        <div className="
          bg-black/70 backdrop-blur-xl
          border border-cyan-400
          text-white
          rounded-3xl
          shadow-[0_0_40px_rgba(0,255,255,0.2)]
          max-w-2xl
          p-12
          text-center
        ">

          {/* System Label */}
          {/* Title */}
          <h1 className="text-2xl md:text-2xl font-semibold mb-6 leading-relaxed max-w-2xl mx-auto">
            This is a 14-question reasoning test.
            You will be paired with an AI model that is currently being trained and evaluated.
            Your performance will be compared with the AI’s performance in order to benchmark human and algorithmic reasoning under time constraints.
          </h1>

          {/* Description */}
          <p className="text-gray-300 leading-relaxed mb-8 text-lg max-w-xl mx-auto">
            Your participation helps us better calibrate the model’s performance relative to human participants.
            You will have 30 seconds to complete each matrix. However, once either you or the AI completes a matrix, the task will automatically proceed to the next one.
            Click the button below to begin.
          </p>

          {/* Begin Button */}
          <button
            onClick={() => {
              setStarted(true);
              setExperimentStartTime(Date.now());
            }}
            className="
              px-10 py-4
              bg-black/80 backdrop-blur-md
              text-cyan-400
              rounded-2xl
              border border-cyan-400
              shadow-[0_0_20px_rgba(0,255,255,0.3)]
              tracking-widest
              text-lg
              hover:bg-cyan-400 hover:text-black
              hover:shadow-[0_0_25px_rgba(0,255,255,0.8)]
              hover:scale-105 active:scale-95
              transition-all duration-300
            "
          >
            BEGIN
          </button>

        </div>

      </div>
    );
  }

  if (current >= questions.length) {

    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;
    const formattedSeconds = seconds.toString().padStart(2, "0");

    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">

        <div className="
          bg-black/70 backdrop-blur-xl
          border border-cyan-400
          text-white
          rounded-3xl
          shadow-[0_0_40px_rgba(0,255,255,0.2)]
          max-w-xl
          px-16 py-14
          text-center
        ">

          {/* System Label */}
          <h1 className="text-3xl font-semibold mb-6 tracking-wide">
            Experiment completed.
          </h1>
          <p className="text-lg text-gray-400 mt-4">
            Total time: <span className="text-cyan-400 font-semibold">
              {minutes}m {seconds}s
            </span>
          </p>
          <p className="text-xl text-gray-300">
            Your score: <span className="text-cyan-400 font-semibold">{score}</span>
          </p>
          <p className="text-xl text-gray-300">
            AI's score: <span className="text-red-400 font-semibold">{opponentScore}</span>
          </p>

        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center relative">
  
  {/* QUESTION HUD */}
  <div className="absolute top-4 left-4 
    bg-black/80 backdrop-blur-md 
    text-white px-6 py-3 
    rounded-2xl shadow-2xl 
    border border-cyan-400">

    <div className="text-center">
      <p className="text-xs tracking-widest text-cyan-400">
        QUESTION
      </p>
      <p className="text-2xl font-bold">
        {current + 1}
        <span className="text-sm text-gray-300 ml-2">
          / {questions.length}
        </span>
      </p>
    </div>

  </div>


  {/* Game Scoreboard */}
  <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md 
    text-white px-6 py-3 rounded-2xl shadow-2xl 
    flex gap-8 items-center border border-cyan-400">
    
    {/* USER */}
    <div className="text-center">
      <p className="text-xs tracking-widest text-cyan-400">YOUR SCORE</p>
      <p className="text-2xl font-bold text-green-400">{score}</p>
    </div>

    {/* TIME */}
    <div className="text-center">
      <p className="text-xs tracking-widest text-cyan-400">TIME</p>
      <p className={`text-2xl font-bold ${
        timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-white"
      }`}>
        {timeLeft}s
      </p>
    </div>
  </div>
      
  {/* OPPONENT SCOREBOARD */}
  <div className="absolute top-28 right-4 
    bg-black/80 backdrop-blur-md 
    text-white px-6 py-3 
    rounded-2xl shadow-2xl 
    border border-cyan-400">
  
    <div className="text-center">
      <p className="text-xs tracking-widest text-cyan-400">
        AI's Score
      </p>
      <p className="text-2xl font-bold text-red-400">
        {opponentScore}
      </p>
    </div>
  
  </div>  

      <img
        src={`/images/q${questions[current].id}.png`}
        alt="question"
        className="mb-6 max-w-xl"
      />

      <div className="grid grid-cols-6 gap-6">
        {generateOptions(questions[current].id).map((option, index) => (
          <div key={index} className="relative">
          <img
            src={option}
            alt="option"
            onClick={() => handleAnswer(index)}
            className={`w-24 h-24 object-contain transition
              ${autoAnswered && index === questions[current].correct
                ? "ring-4 ring-red-500 scale-110"
                : ""}
              ${selectedIndex === index
                ? "ring-4 ring-cyan-400 scale-110"
                : "cursor-pointer hover:scale-105"
              }`}
          />
        
          {showWrongMark && selectedIndex === index && (
            <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center rounded">
              <span className="text-red-600 text-7xl font-bold">✕</span>
            </div>
          )}
        </div>
      
        ))}
      </div>



    </div>
  );
}

