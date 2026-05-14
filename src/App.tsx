import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Heart, 
  Star, 
  Smile, 
  Home, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Trophy, 
  Sparkles,
  Gamepad2,
  GraduationCap,
  Timer,
  LayoutGrid,
  BookOpen,
  Brain,
  Zap,
  Target,
  Link,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Types ---

type AppMode = 'home' | 'games_hub' | 'study' | 'grid' | 'playing' | 'result' | 'memory' | 'chain' | 'selection' | 'stats';
type GameType = 'classic' | 'speed' | 'missing' | 'memory' | 'chain';
type Difficulty = 'facile' | 'medio' | 'difficile';

interface Question {
  id: number;
  num1: number;
  num2: number;
  answer: number;
  options: number[];
  displayOp: string; 
  contextValue?: number; // For chain reaction
}

interface GameState {
  type: GameType;
  tables: number[];
  difficulty: Difficulty;
  score: number;
  currentIdx: number;
  timeLeft: number;
  questions: Question[];
}

interface MemoryCard {
  id: number;
  content: string | number;
  pairId: number;
  isFlipped: boolean;
  isMatched: boolean;
}

// --- Constants & Helpers ---

// --- Sound Effects Utility ---
const SOUND_URLS = {
  correct: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  wrong: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  victory: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  flip: 'https://assets.mixkit.co/active_storage/sfx/2590/2590-preview.mp3'
};

const playSound = (type: keyof typeof SOUND_URLS) => {
  const audio = new Audio(SOUND_URLS[type]);
  audio.volume = 0.4;
  audio.play().catch(() => {});
};

const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const FEEDBACK_WORDS = ['GRANDE!', 'MAGNIFICO!', 'PERFETTO!', 'ECCELLENTE!', 'MITICO!', 'SUPER!'];

const getRandomFeedback = () => FEEDBACK_WORDS[Math.floor(Math.random() * FEEDBACK_WORDS.length)];

const generateQuestion = (tables: number[], type: GameType, difficulty: Difficulty = 'medio', contextValue?: number): Question => {
  const n1 = contextValue ?? (tables[Math.floor(Math.random() * tables.length)]);
  
  let n2;
  if (difficulty === 'facile') {
    n2 = Math.floor(Math.random() * 5) + 1; // 1-5 for Easy
  } else {
    n2 = Math.floor(Math.random() * 10) + 1; // 1-10 for others
  }
  
  const answerValue = n1 * n2;
  
  const optionsSet = new Set<number>([answerValue]);
  const optionsCount = (type === 'speed') 
    ? (difficulty === 'facile' ? 10 : 15) 
    : (type === 'chain') 
      ? (difficulty === 'facile' ? 8 : 12) 
      : 4;

  let protection = 0;
  while (optionsSet.size < optionsCount && protection < 200) {
    protection++;
    let offset;
    if (difficulty === 'facile') {
        offset = Math.floor(Math.random() * 21) - 10;
    } else if (difficulty === 'medio') {
        offset = Math.floor(Math.random() * 31) - 15;
    } else {
        // Hard: distractors are very close or shared table factors
        const possibleOffsets = [-2, -1, 1, 2, n1, -n1, 10, -10, 5, -5, 3, -3, 11, -11, 9, -9];
        offset = possibleOffsets[Math.floor(Math.random() * possibleOffsets.length)];
        if (Math.random() > 0.7) offset += (Math.floor(Math.random() * 5) - 2);
    }
    const dist = Math.max(1, answerValue + offset);
    if (dist !== answerValue) optionsSet.add(dist);
  }

  let displayOp = `${n1} × ${n2}`;
  if (type === 'missing') {
    const hole = Math.random() > 0.5 ? 1 : 2;
    displayOp = hole === 1 ? `? × ${n2} = ${answerValue}` : `${n1} × ? = ${answerValue}`;
    const realAnswer = hole === 1 ? n1 : n2;
    const optSet = new Set<number>([realAnswer]);
    while (optSet.size < 4) {
      const d = Math.max(1, Math.min(10, realAnswer + (difficulty === 'difficile' ? (Math.random() > 0.5 ? 1 : -1) : Math.floor(Math.random() * 5) - 2)));
      optSet.add(d);
    }
    return {
      id: Math.random(),
      num1: n1,
      num2: n2,
      answer: realAnswer,
      options: Array.from(optSet).sort(() => Math.random() - 0.5),
      displayOp
    };
  }

  if (type === 'chain') {
    displayOp = `${n1} × ${n2}`;
  }

  return {
    id: Math.random(),
    num1: n1,
    num2: n2,
    answer: answerValue,
    options: Array.from(optionsSet).sort(() => Math.random() - 0.5),
    displayOp
  };
};

const generateQuiz = (tables: number[], type: GameType, difficulty: Difficulty = 'medio', length = 10): Question[] => {
  if (type === 'chain') {
    const questions: Question[] = [];
    const chainLength = 100; // Large enough for a timed game
    let nextFactor = tables[Math.floor(Math.random() * tables.length)];
    for (let i = 0; i < chainLength; i++) {
        const q = generateQuestion([nextFactor], 'chain', difficulty);
        questions.push(q);
        if (q.answer > 0 && q.answer <= 10) {
            nextFactor = q.answer;
        } else {
            nextFactor = tables[Math.floor(Math.random() * tables.length)];
        }
    }
    return questions;
  }
  return Array.from({ length }, () => generateQuestion(tables, type, difficulty));
};

// --- Memory Game Component ---

const MemoryCardItem: React.FC<{ card: MemoryCard; onClick: () => void }> = ({ card, onClick }) => {
    const isFlipped = card.isFlipped || card.isMatched;

    return (
        <div className="h-24 sm:h-32 relative [perspective:1000px]">
            <motion.div
                initial={false}
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
                className="w-full h-full relative [transform-style:preserve-3d]"
                onClick={onClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                {/* Back of card (Hidden side) */}
                <div 
                    className="absolute inset-0 [backface-visibility:hidden] bg-pink-500 border-4 border-pink-700 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-md cursor-pointer"
                    onClick={() => { playSound('flip'); onClick(); }}
                >
                    <span className="text-4xl text-white font-black opacity-30">?</span>
                </div>

                {/* Front of card (Content side) */}
                <div 
                    className={`absolute inset-0 [backface-visibility:hidden] bg-white border-4 border-pink-400 rounded-2xl sm:rounded-3xl flex items-center justify-center text-lg sm:text-2xl font-black text-pink-500 shadow-md [transform:rotateY(180deg)] ${card.isMatched ? 'opacity-80' : ''}`}
                >
                    {card.content}
                    {card.isMatched && (
                        <motion.div 
                            initial={{ scale: 0, rotate: -20 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className="absolute -top-3 -right-3 bg-green-500 text-white rounded-full p-2 shadow-lg z-10"
                        >
                            <Check size={20} strokeWidth={4} />
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

const MemoryGame = ({ tables, difficulty, onComplete }: { tables: number[], difficulty: Difficulty, onComplete: (score: number) => void }) => {
    const [cards, setCards] = useState<MemoryCard[]>([]);
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    const [moves, setMoves] = useState(0);
    const [matches, setMatches] = useState(0);

    const pairsCount = difficulty === 'facile' ? 6 : difficulty === 'medio' ? 10 : 12;

    useEffect(() => {
        const newCards: MemoryCard[] = [];
        const usedResults = new Set<number>();
        
        let attempts = 0;
        while (newCards.length < pairsCount * 2 && attempts < 200) {
            attempts++;
            const n1 = tables[Math.floor(Math.random() * tables.length)];
            const n2 = Math.floor(Math.random() * 10) + 1;
            const res = n1 * n2;
            
            // Avoid duplicate results to prevent confusion
            if (!usedResults.has(res)) {
                usedResults.add(res);
                const pairId = newCards.length / 2;
                newCards.push({ id: pairId * 2, content: `${n1}x${n2}`, pairId, isFlipped: false, isMatched: false });
                newCards.push({ id: pairId * 2 + 1, content: res, pairId, isFlipped: false, isMatched: false });
            }
        }
        setCards(newCards.sort(() => Math.random() - 0.5));
    }, [tables, difficulty, pairsCount]);

    const handleCardClick = (idx: number) => {
        if (flippedIndices.length === 2 || cards[idx].isFlipped || cards[idx].isMatched) return;

        const newFlipped = [...flippedIndices, idx];
        setFlippedIndices(newFlipped);

        const newCards = [...cards];
        newCards[idx].isFlipped = true;
        setCards(newCards);

        if (newFlipped.length === 2) {
            setMoves(m => m + 1);
            const [first, second] = newFlipped;
            if (cards[first].pairId === cards[second].pairId) {
                setTimeout(() => {
                    const matchedCards = [...cards];
                    matchedCards[first].isMatched = true;
                    matchedCards[second].isMatched = true;
                    setCards(matchedCards);
                    setFlippedIndices([]);
                    setMatches(m => {
                        if (m + 1 === pairsCount) {
                            setTimeout(() => onComplete(10), 1000);
                        }
                        return m + 1;
                    });
                    confetti({ particleCount: 20, spread: 40 });
                }, 600);
            } else {
                setTimeout(() => {
                    const resetCards = [...cards];
                    resetCards[first].isFlipped = false;
                    resetCards[second].isFlipped = false;
                    setCards(resetCards);
                    setFlippedIndices([]);
                }, 1000);
            }
        }
    };

    const gridCols = difficulty === 'facile' ? 'grid-cols-3 sm:grid-cols-4' : difficulty === 'medio' ? 'grid-cols-4 sm:grid-cols-5' : 'grid-cols-4 sm:grid-cols-6';

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="flex justify-between items-center bg-white p-4 rounded-3xl border-4 border-slate-200">
                <span className="text-xl font-black">Mosse: {moves}</span>
                <span className="text-xl font-black uppercase text-pink-500">{difficulty}</span>
                <span className="text-xl font-black">Coppie: {matches} / {pairsCount}</span>
            </div>
            <div className={`grid ${gridCols} gap-3`}>
                {cards.map((card, idx) => (
                    <MemoryCardItem 
                        key={card.id} 
                        card={card} 
                        onClick={() => handleCardClick(idx)} 
                    />
                ))}
            </div>
        </div>
    );
};

// --- Custom Components ---

interface CartoonButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
  disabled?: boolean;
  animate?: any;
}

const CartoonButton: React.FC<CartoonButtonProps> = ({ 
  children, 
  onClick, 
  className = "", 
  variant = "primary", 
  disabled = false,
  animate
}) => {
  const variants = {
    primary: "bg-pink-500 text-white border-pink-700 shadow-[0_6px_0_0_#be123c]",
    secondary: "bg-white text-slate-700 border-slate-200 shadow-[0_6px_0_0_#e2e8f0]",
    accent: "bg-yellow-400 text-slate-800 border-yellow-600 shadow-[0_6px_0_0_#ca8a04]",
    danger: "bg-rose-500 text-white border-rose-700 shadow-[0_6px_0_0_#be123c]"
  };

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.05, translateY: -2 } : {}}
      whileTap={!disabled ? { scale: 0.95, translateY: 4 } : {}}
      animate={animate}
      onClick={onClick}
      disabled={disabled}
      className={`
        relative px-8 py-4 rounded-3xl text-xl font-black border-4 transition-all uppercase tracking-tight
        flex items-center justify-center gap-2
        ${variants[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:brightness-110 active:shadow-none active:translate-y-[6px]'}
        ${className}
      `}
    >
      {children}
    </motion.button>
  );
};

const KawaiiCard: React.FC<{ children: React.ReactNode, className?: string, onClick?: () => void }> = ({ children, className = "", onClick }) => (
  <motion.div 
    whileHover={{ scale: 1.02, rotate: 1 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`
      bg-white rounded-[2.5rem] border-[6px] p-6 shadow-xl cursor-pointer transition-all relative overflow-hidden
      ${className}
    `}
  >
    {children}
  </motion.div>
);

const MultiplicationGrid = () => {
  const [highlight, setHighlight] = useState<{ r: number, c: number } | null>(null);

  const colors = [
    'bg-slate-800', // for 0/X
    'bg-red-400',    // 1
    'bg-orange-400', // 2
    'bg-yellow-400', // 3
    'bg-lime-400',   // 4
    'bg-green-400',  // 5
    'bg-emerald-400',// 6
    'bg-teal-400',   // 7
    'bg-sky-400',    // 8
    'bg-indigo-400', // 9
    'bg-purple-400', // 10
  ];

  const borderColors = [
    'border-slate-900',
    'border-red-600',
    'border-orange-600',
    'border-yellow-600',
    'border-lime-600',
    'border-green-600',
    'border-emerald-600',
    'border-teal-600',
    'border-sky-600',
    'border-indigo-600',
    'border-purple-600',
  ];

  const textColors = [
    'text-white',
    'text-white',
    'text-white',
    'text-yellow-900',
    'text-lime-900',
    'text-white',
    'text-white',
    'text-white',
    'text-white',
    'text-white',
    'text-white',
  ];

  const lightColors = [
    'bg-slate-50',
    'bg-red-50',
    'bg-orange-50',
    'bg-yellow-50',
    'bg-lime-50',
    'bg-green-50',
    'bg-emerald-50',
    'bg-teal-50',
    'bg-sky-50',
    'bg-indigo-50',
    'bg-purple-50',
  ];

  return (
    <div className="bg-white rounded-[3rem] p-4 shadow-xl overflow-x-auto relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px]" />
      
      <div className="min-w-[700px] grid grid-cols-11 gap-1.5 relative z-10">
        {/* Top-left corner */}
        <div className="bg-slate-800 text-white p-4 font-black text-center text-3xl rounded-2xl flex items-center justify-center shadow-md">
            ×
        </div>

        {/* Header Row */}
        {TABLES.map(t => (
          <div 
            key={t} 
            className={`
                ${colors[t]} ${textColors[t]} p-4 font-black text-center border-2 ${borderColors[t]} text-xl
                rounded-2xl shadow-sm
                transition-all duration-300
                ${highlight?.c === t ? 'scale-105 z-20 shadow-lg brightness-110' : ''}
            `}
          >
            {t}
          </div>
        ))}
        
        {TABLES.map(r => (
          <React.Fragment key={r}>
            {/* Header Column */}
            <div 
                className={`
                    ${colors[r]} ${textColors[r]} p-4 font-black text-center border-2 ${borderColors[r]} text-xl
                    rounded-2xl shadow-sm
                    transition-all duration-300
                    ${highlight?.r === r ? 'scale-105 z-20 shadow-lg brightness-110' : ''}
                `}
            >
              {r}
            </div>

            {/* Body Cells */}
            {TABLES.map(c => {
              const isHighlight = highlight && (highlight.r === r || highlight.c === c);
              const isCell = highlight && (highlight.r === r && highlight.c === c);
              
              return (
                <div 
                  key={c}
                  onMouseEnter={() => setHighlight({ r, c })}
                  onMouseLeave={() => setHighlight(null)}
                  className={`
                    p-4 font-black text-center border-[1.5px] border-slate-100 transition-all duration-200 cursor-crosshair text-lg
                    rounded-xl
                    ${isCell 
                        ? 'bg-purple-600 text-white scale-125 z-30 shadow-2xl ring-4 ring-yellow-400' 
                        : isHighlight 
                            ? `${lightColors[r]} ${lightColors[c]} mix-blend-multiply opacity-80 border-slate-200` 
                            : 'bg-slate-50/50 hover:bg-slate-100'}
                  `}
                >
                  {r * c}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const InteractiveGrid = () => {
    const [values, setValues] = useState<Record<string, string>>({});
    const [checked, setChecked] = useState(false);
    const [hint, setHint] = useState<string | null>(null);

    const colors = ['bg-slate-800', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-lime-400', 'bg-green-400', 'bg-emerald-400', 'bg-teal-400', 'bg-sky-400', 'bg-indigo-400', 'bg-purple-400'];
    const textColors = ['text-white', 'text-white', 'text-white', 'text-yellow-900', 'text-lime-900', 'text-white', 'text-white', 'text-white', 'text-white', 'text-white', 'text-white'];

    const handleInputChange = (r: number, c: number, val: string) => {
        setValues(prev => ({ ...prev, [`${r}-${c}`]: val }));
        setChecked(false);
        setHint(null);
        if (val !== "") {
            const expected = r * c;
            if (parseInt(val) === expected) {
                playSound('correct');
            } else {
                // We only play wrong if they actually entered a full number or after check
                // For direct typing we might want to be quiet or play a small sound
            }
        }
    };

    const resetGrid = () => {
        if (confirm("Vuoi davvero cancellare tutto?")) {
            setValues({});
            setChecked(false);
            setHint(null);
        }
    };

    const showHint = () => {
        setHint("💡 Ricorda: moltiplicare per 1 lascia il numero uguale, per 10 aggiungi uno 0!");
    };

    const revealCell = () => {
        const uncompleted: string[] = [];
        TABLES.forEach(r => {
            TABLES.forEach(c => {
                const key = `${r}-${c}`;
                if (!values[key] || parseInt(values[key]) !== r * c) {
                    uncompleted.push(key);
                }
            });
        });

        if (uncompleted.length > 0) {
            const randomKey = uncompleted[Math.floor(Math.random() * uncompleted.length)];
            const [r, c] = randomKey.split('-').map(Number);
            handleInputChange(r, c, (r * c).toString());
            playSound('correct');
        }
    };

    const score = Object.entries(values).reduce((acc, [key, val]) => {
        const [r, c] = key.split('-').map(Number);
        return acc + (parseInt(val as string) === r * c ? 1 : 0);
    }, 0);

    return (
        <div className="space-y-12">
            <div className="max-w-3xl mx-auto bg-orange-50 rounded-[2.5rem] border-4 border-dashed border-orange-200 p-6 text-center shadow-inner relative overflow-hidden">
                <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative z-10">
                    <p className="text-xl font-black text-orange-700">
                        {hint || (checked 
                            ? (score === 100 ? "INCREDIBILE! La griglia è perfetta! 🏆" : `Hai trovato ${score} risultati giusti! Controlla quelli rossi... ✍️`)
                            : "Scegli una casella e scrivi il risultato. Ce la puoi fare! 🌟")}
                    </p>
                </motion.div>
            </div>

            <div className="bg-white rounded-[3rem] p-4 shadow-xl overflow-x-auto">
                <div className="min-w-[800px] grid grid-cols-11 gap-2">
                    <div className="bg-slate-800 text-white p-4 font-black text-center text-3xl rounded-2xl flex items-center justify-center shadow-md">×</div>
                    {TABLES.map(t => <div key={t} className={`${colors[t]} ${textColors[t]} p-4 font-black text-center rounded-2xl text-xl shadow-sm`}>{t}</div>)}
                    {TABLES.map(r => (
                        <React.Fragment key={r}>
                            <div className={`${colors[r]} ${textColors[r]} p-4 font-black text-center rounded-2xl text-xl shadow-sm`}>{r}</div>
                            {TABLES.map(c => {
                                const val = values[`${r}-${c}`] || "";
                                const isCorrect = checked && parseInt(val) === r * c;
                                const isWrong = checked && val !== "" && parseInt(val) !== r * c;
                                return (
                                    <input
                                        key={c}
                                        type="number"
                                        value={val}
                                        onChange={(e) => handleInputChange(r, c, e.target.value)}
                                        className={`
                                            w-full py-4 px-1 text-center text-xl font-black rounded-2xl border-2 transition-all outline-none
                                            ${isCorrect ? 'bg-green-100 border-green-500 text-green-700 scale-105 z-10 shadow-md' : 
                                              isWrong ? 'bg-rose-100 border-rose-500 text-rose-700 animate-shake' : 
                                              'bg-slate-50 border-slate-100 focus:bg-white focus:border-sky-400 focus:ring-4 focus:ring-sky-100'}
                                        `}
                                    />
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap justify-center gap-6 pb-20">
                <CartoonButton variant="accent" onClick={() => setChecked(true)} className="!px-12 !py-5 !text-2xl">Controlla ✅</CartoonButton>
                <CartoonButton variant="secondary" onClick={revealCell} className="!px-12 !py-5 !text-2xl !border-yellow-300">Regalo 🎁</CartoonButton>
                <CartoonButton variant="secondary" onClick={showHint} className="!px-12 !py-5 !text-2xl !border-sky-200">Aiutino? 💡</CartoonButton>
                <CartoonButton onClick={resetGrid} className="!px-12 !py-5 !text-2xl !bg-rose-500 !border-rose-700">Cancella 🧹</CartoonButton>
            </div>
        </div>
    );
};

// --- Stats View Component ---

const StatsView = ({ stats, onBack, onStartExercise }: { 
    stats: Record<string, { correct: number; wrong: number }>, 
    onBack: () => void,
    onStartExercise: (tables: number[]) => void
}) => {
    const tableErrors: Record<number, number> = {};
    TABLES.forEach(t => { tableErrors[t] = 0; });
    
    Object.entries(stats).forEach(([key, val]) => {
        const parts = key.split('x');
        if (parts.length === 2) {
            const a = Number(parts[0]);
            const b = Number(parts[1]);
            if (val.wrong > 0) {
                if (tableErrors[a] !== undefined) tableErrors[a] += val.wrong;
                if (tableErrors[b] !== undefined) tableErrors[b] += val.wrong;
            }
        }
    });

    const chartData = TABLES.map(t => {
        let correct = 0;
        let wrong = 0;
        Object.entries(stats).forEach(([key, val]) => {
            const parts = key.split('x');
            if (parts.length === 2) {
                const a = Number(parts[0]);
                const b = Number(parts[1]);
                if (a === t || b === t) {
                    correct += val.correct;
                    wrong += val.wrong;
                }
            }
        });
        return {
            name: `T${t}`,
            corrette: correct,
            sbagliate: wrong
        };
    });

    const difficultTables = Object.entries(tableErrors)
        .filter(([_, errors]) => errors > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([t]) => Number(t));

    const totalMistakes = Object.values(stats).reduce((acc, s) => acc + s.wrong, 0);

    return (
        <div className="max-w-4xl mx-auto space-y-12 pb-20">
            <div className="text-center space-y-4">
                <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="inline-block bg-white p-4 rounded-3xl border-4 border-slate-200 shadow-lg -rotate-2 mb-4"
                >
                    <Star className="text-yellow-400" size={40} fill="currentColor" />
                </motion.div>
                <h2 className="text-6xl font-black text-slate-900 uppercase italic tracking-tighter">Il Tuo Diario</h2>
                <p className="text-xl font-bold text-slate-400">Guarda come stai andando e migliora le tue abilità!</p>
            </div>

            {totalMistakes === 0 ? (
                <div className="bg-white p-12 rounded-[3.5rem] border-[6px] border-emerald-200 text-center shadow-xl">
                    <Smile size={100} className="text-emerald-500 mx-auto mb-6" />
                    <h3 className="text-4xl font-black text-slate-800 mb-4">Ancora Nessun Errore!</h3>
                    <p className="text-xl font-bold text-slate-500">Inizia a giocare per vedere i tuoi progressi qui. Sei bravissimo! 🌟</p>
                </div>
            ) : (
                <div className="space-y-12">
                    {/* Grafico delle Prestazioni */}
                    <KawaiiCard className="border-indigo-300 !cursor-default overflow-hidden">
                        <h3 className="text-3xl font-black mb-8 flex items-center gap-3 text-indigo-700">
                            <Zap className="text-indigo-500" /> Andamento per Tabellina
                        </h3>
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#64748b', fontWeight: 'bold' }} 
                                    />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                    <Tooltip 
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '1rem' }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '2rem' }} />
                                    <Bar dataKey="corrette" fill="#4ade80" radius={[6, 6, 0, 0]} name="Corrette" />
                                    <Bar dataKey="sbagliate" fill="#f43f5e" radius={[6, 6, 0, 0]} name="Sbagliate" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </KawaiiCard>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2 space-y-8">
                        <KawaiiCard className="border-pink-300 !cursor-default">
                             <h3 className="text-3xl font-black mb-8 flex items-center gap-3">
                                <Target className="text-pink-500" /> Il Tuo Stato Attuale
                             </h3>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                                {TABLES.map(t => {
                                    const errors = tableErrors[t];
                                    const intensity = Math.min(errors * 20, 100);
                                    return (
                                        <div key={t} className="space-y-1">
                                            <div className="flex justify-between items-end">
                                                <span className="text-xl font-black">Tabellina del {t}</span>
                                                <span className={`text-xs font-bold uppercase ${errors === 0 ? 'text-green-500' : 'text-slate-400'}`}>
                                                    {errors === 0 ? 'Perfetta! ✨' : `${errors} ❌`}
                                                </span>
                                            </div>
                                            <div className="h-4 bg-slate-100 rounded-full overflow-hidden border-2 border-slate-200 p-0.5">
                                                <motion.div 
                                                    initial={{ width: 0 }}
                                                    animate={{ width: errors === 0 ? '100%' : `${intensity}%` }}
                                                    className={`h-full rounded-full ${errors === 0 ? 'bg-emerald-400' : intensity > 60 ? 'bg-rose-500' : intensity > 30 ? 'bg-orange-400' : 'bg-yellow-400'}`}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                             </div>
                        </KawaiiCard>

                        <KawaiiCard className="border-sky-400 !cursor-default">
                            <h3 className="text-3xl font-black mb-6 flex items-center gap-2">
                                <Sparkles className="text-sky-500" /> Suggerimenti Mirati
                            </h3>
                            <div className="space-y-6">
                                {difficultTables.length > 0 && (
                                    <div className="p-8 bg-sky-50 rounded-[2rem] border-2 border-sky-100 italic font-bold text-sky-800 text-xl leading-relaxed shadow-inner">
                                        "Sembra che le tabelline di {difficultTables.slice(0, 3).join(', ')} ti diano un po' di filo da rotcere. 
                                        Prova a studiarle bene prima di sfidare il tempo!"
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-4">
                                    <CartoonButton 
                                        variant="accent"
                                        onClick={() => onStartExercise(difficultTables.length > 0 ? [difficultTables[0]] : [TABLES[0]])}
                                        className="!text-lg !px-8"
                                    >
                                        Esercitati su {difficultTables.length > 0 ? difficultTables[0] : TABLES[0]}
                                    </CartoonButton>
                                    <CartoonButton 
                                        variant="secondary"
                                        onClick={() => onStartExercise(difficultTables.slice(0, 3))}
                                        className="!text-lg !px-8"
                                    >
                                        Sfida sulle 3 Difficili
                                    </CartoonButton>
                                </div>
                            </div>
                        </KawaiiCard>
                    </div>

                    <div className="space-y-8">
                        <KawaiiCard className="border-yellow-400 bg-yellow-50/50 !cursor-default">
                             <div className="text-center space-y-4">
                                <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                                    <Trophy size={64} className="text-yellow-500 mx-auto" />
                                </motion.div>
                                <h4 className="text-2xl font-black text-yellow-900 uppercase">Errori Totali</h4>
                                <div className="text-6xl font-black text-yellow-600 drop-shadow-md">{totalMistakes}</div>
                                <p className="text-sm font-bold text-yellow-700/60 uppercase p-2 border-t-2 border-yellow-200">Ogni errore è un passo verso la vittoria!</p>
                             </div>
                        </KawaiiCard>
                        
                        <div className="bg-white p-8 rounded-[3rem] border-4 border-slate-200 shadow-lg">
                            <h4 className="text-xl font-black mb-6 uppercase text-slate-500 tracking-wider">Le Più Toste 🌋</h4>
                            <div className="space-y-4">
                                {Object.entries(stats)
                                    .filter(([_, val]) => val.wrong > 0)
                                    .sort((a, b) => b[1].wrong - a[1].wrong)
                                    .slice(0, 5)
                                    .map(([key, val]) => (
                                        <div key={key} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 hover:bg-white transition-colors">
                                            <span className="font-black text-2xl text-slate-700">{key}</span>
                                            <span className="bg-rose-100 text-rose-600 px-4 py-2 rounded-2xl text-sm font-black border-2 border-rose-200 italic">
                                                {val.wrong}× ❌
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            )}

            <div className="text-center pt-6">
                <CartoonButton variant="secondary" onClick={onBack} className="!px-12">Torna Indietro</CartoonButton>
            </div>
        </div>
    );
};

// --- Daily Challenge Result View ---

export default function App() {
  const [mode, setMode] = useState<AppMode>('home');
  const [game, setGame] = useState<GameState | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [currentSpeedQuestion, setCurrentSpeedQuestion] = useState<Question | null>(null);
  const [selectedTables, setSelectedTables] = useState<number[]>([2]);
  const [difficulty, setDifficulty] = useState<Difficulty>('medio');
  const [gridSubMode, setGridSubMode] = useState<'view' | 'complete'>('view');
  const [pendingGameType, setPendingGameType] = useState<GameType | null>(null);

  const [feedbackWord, setFeedbackWord] = useState('');

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const isTimedMode = game?.type === 'speed' || game?.type === 'chain';
    
    if (mode === 'playing' && isTimedMode && game.timeLeft > 0) {
      timer = setInterval(() => {
        setGame(prev => prev ? { ...prev, timeLeft: prev.timeLeft - 1 } : null);
      }, 1000);
    } else if (game?.timeLeft === 0 && isTimedMode && mode === 'playing') {
      playSound('victory');
      setMode('result');
      confetti({ particleCount: 150, spread: 100 });
    }
    return () => clearInterval(timer);
  }, [mode, game?.type, game?.timeLeft]);

  const toggleTable = (t: number) => {
    setSelectedTables(prev => {
        if (prev.includes(t)) {
            if (prev.length === 1) return prev;
            return prev.filter(x => x !== t);
        }
        return [...prev, t].sort((a, b) => a - b);
    });
  };

  const startNewGame = (type: GameType) => {
    let length = 10;
    if (type === 'classic') {
        length = difficulty === 'facile' ? 10 : difficulty === 'medio' ? 15 : 20;
    } else if (type === 'speed') {
        length = difficulty === 'facile' ? 10 : difficulty === 'medio' ? 10 : 15;
    }

    if (type === 'memory') {
        setMode('memory');
        setGame({
            type,
            tables: selectedTables,
            difficulty,
            score: 0,
            currentIdx: 0,
            timeLeft: 0,
            questions: []
        });
        return;
    }

    const questions = generateQuiz(selectedTables, type, difficulty, length);
    
    let initialTime = 0;
    if (type === 'speed') {
      initialTime = 60;
    } else if (type === 'chain') {
      initialTime = difficulty === 'facile' ? 30 : difficulty === 'medio' ? 20 : 15;
    }

    setGame({
      type,
      tables: selectedTables,
      difficulty,
      score: 0,
      currentIdx: 0,
      timeLeft: initialTime,
      questions
    });
    if (type === 'speed') {
      setCurrentSpeedQuestion(generateQuestion(selectedTables, 'speed', difficulty));
    }
    setMode('playing');
  };

  const [stats, setStats] = useState<Record<string, { correct: number; wrong: number }>>({});

  useEffect(() => {
    const savedStats = localStorage.getItem('multiplication_stats');
    if (savedStats) {
      try {
        setStats(JSON.parse(savedStats));
      } catch (e) {
        console.error("Failed to parse stats", e);
      }
    }
  }, []);

  const updateStats = (num1: number, num2: number, correct: boolean) => {
    const key = `${Math.min(num1, num2)}x${Math.max(num1, num2)}`;
    setStats(prev => {
      const current = prev[key] || { correct: 0, wrong: 0 };
      const newStats = {
        ...prev,
        [key]: {
          correct: current.correct + (correct ? 1 : 0),
          wrong: current.wrong + (correct ? 0 : 1)
        }
      };
      localStorage.setItem('multiplication_stats', JSON.stringify(newStats));
      return newStats;
    });
  };

  const handleAnswer = (choice: number) => {
    if (!game || feedback) return;

    const currentQ = game.type === 'speed' ? currentSpeedQuestion : game.questions[game.currentIdx];
    if (!currentQ) return;

    const isCorrect = choice === currentQ.answer;
    updateStats(currentQ.num1, currentQ.num2, isCorrect);

    if (isCorrect) {
      playSound('correct');
      setFeedback('correct');
      setFeedbackWord(getRandomFeedback());
      setGame(prev => {
        if (!prev) return null;
        const extraTime = prev.type === 'chain' ? 3 : 0;
        return { 
            ...prev, 
            score: prev.score + 1,
            timeLeft: prev.timeLeft + extraTime
        };
      });
      confetti({
        particleCount: 30,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#FF69B4', '#FFD700', '#00BFFF']
      });
    } else {
      playSound('wrong');
      setFeedback('wrong');
    }

    setTimeout(() => {
      setFeedback(null);
      if (game.type === 'speed') {
        setCurrentSpeedQuestion(generateQuestion(game.tables, 'speed', game.difficulty));
      } else if (game.currentIdx < game.questions.length - 1) {
        setGame(prev => prev ? { ...prev, currentIdx: prev.currentIdx + 1 } : null);
      } else {
        playSound('victory');
        setMode('result');
        if (game.score >= 8) confetti({ particleCount: 150 });
      }
    }, feedback === 'wrong' ? 1200 : 800);
  };

  const handleMemoryComplete = (score: number) => {
    playSound('victory');
    setGame({ type: 'memory', tables: selectedTables, difficulty, score, currentIdx: 0, timeLeft: 0, questions: [] });
    setMode('result');
    confetti({ particleCount: 150 });
  };

  const handleStartTargetedExercise = (tables: number[]) => {
    setSelectedTables(tables);
    startNewGame('classic');
  };

  const activeQuestion = game?.type === 'speed' ? currentSpeedQuestion : (game ? game.questions[game.currentIdx] : null);

  return (
    <div className="min-h-screen bg-[#FFF5F8] font-sans text-slate-800">
      <div className="fixed inset-0 pointer-events-none opacity-10 overflow-hidden">
         <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-20 -left-20 text-pink-400"><Star size={200} fill="currentColor" /></motion.div>
         <motion.div animate={{ y: [0, 20, 0] }} transition={{ duration: 4, repeat: Infinity }} className="absolute bottom-10 right-10 text-sky-400"><Smile size={150} fill="currentColor" /></motion.div>
         <div className="absolute top-1/2 left-10 text-yellow-400 rotate-12"><Heart size={80} fill="currentColor" /></div>
      </div>

      <header className="relative p-6 flex justify-between items-center max-w-6xl mx-auto z-30">
        <motion.div 
            whileHover={{ scale: 1.05 }}
            onClick={() => setMode('home')}
            className="flex items-center gap-4 cursor-pointer"
        >
            <div className="w-14 h-14 bg-pink-500 rounded-2xl flex items-center justify-center text-white border-4 border-pink-700 shadow-[4px_4px_0_0_#be123c] -rotate-3">
                <GraduationCap size={32} />
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">
                Tabelline <span className="text-pink-500">Super!</span>
            </h1>
        </motion.div>
        
        <nav className="flex gap-4">
            {mode !== 'home' && (
                <CartoonButton variant="secondary" onClick={() => { setMode('home'); setGame(null); }} className="!px-4 !py-2 !text-base">
                    <Home size={20} /> Home
                </CartoonButton>
            )}
        </nav>
      </header>

      <main className="relative max-w-6xl mx-auto p-4 z-20">
        <AnimatePresence mode="wait">
          {mode === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-12 py-10"
            >
                <div className="text-center space-y-6">
                    <motion.div
                        animate={{ scale: [1, 1.1, 1], rotate: [0, 2, -2, 0] }}
                        transition={{ repeat: Infinity, duration: 4 }}
                        className="inline-block bg-yellow-400 border-[6px] border-yellow-600 px-8 py-2 rounded-full shadow-lg -rotate-2"
                    >
                        <span className="text-2xl font-black uppercase text-yellow-900 tracking-tight">Per Super Studenti!</span>
                    </motion.div>
                    <h2 className="text-6xl md:text-8xl font-black text-slate-900 leading-[0.9] tracking-tight">
                        Cosa vuoi <br /> <span className="text-pink-500 inline-block px-4 relative">imparare?
                            <div className="absolute -bottom-2 left-0 w-full h-4 bg-pink-100 -z-10" />
                        </span>
                    </h2>
                </div>

                <div className="bg-white p-8 rounded-[3rem] border-[6px] border-pink-200 shadow-xl max-w-4xl mx-auto space-y-8">
                    <div className="flex flex-col items-center gap-6">
                        <h3 className="text-2xl font-black text-slate-600 uppercase">Scegli le tue tabelline:</h3>
                        <div className="flex flex-wrap justify-center gap-3">
                            {TABLES.map(t => (
                                <motion.button
                                    key={t}
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => toggleTable(t)}
                                    className={`
                                        w-14 h-14 rounded-2xl font-black text-2xl border-4 transition-all
                                        ${selectedTables.includes(t) ? 'bg-pink-500 border-pink-700 text-white shadow-[0_4px_0_0_#be123c]' : 'bg-white border-slate-200 text-slate-400 hover:border-pink-300'}
                                    `}
                                >
                                    {t}
                                </motion.button>
                            ))}
                        </div>
                        <div className="flex gap-4 mt-2">
                             <button onClick={() => setSelectedTables(TABLES)} className="text-sm font-black text-pink-500 uppercase hover:underline">Seleziona Tutte</button>
                             <button onClick={() => setSelectedTables([2])} className="text-sm font-black text-slate-400 uppercase hover:underline">Svuota</button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    <KawaiiCard 
                        onClick={() => setMode('study')}
                        className="border-sky-400 group bg-sky-50/20"
                    >
                        <div className="space-y-4">
                            <div className="w-20 h-20 bg-sky-100 rounded-3xl flex items-center justify-center text-sky-500 border-4 border-sky-400 group-hover:rotate-6 transition-transform">
                                <BookOpen size={40} />
                            </div>
                            <h3 className="text-4xl font-black text-sky-900 underline decoration- sky-100 underline-offset-4">Studio</h3>
                            <p className="text-lg font-bold text-sky-600 leading-tight">Guarda le tabelline scelte e memorizza.</p>
                            <div className="pt-4"><CartoonButton variant="secondary" className="w-full !border-sky-200 !shadow-[0_6px_0_0_#bae6fd]">Inizia</CartoonButton></div>
                        </div>
                    </KawaiiCard>

                    <KawaiiCard 
                        onClick={() => setMode('grid')}
                        className="border-yellow-400 group bg-yellow-50/20"
                    >
                        <div className="space-y-4">
                            <div className="w-20 h-20 bg-yellow-100 rounded-3xl flex items-center justify-center text-yellow-500 border-4 border-yellow-400 group-hover:-rotate-6 transition-transform">
                                <LayoutGrid size={40} />
                            </div>
                            <h3 className="text-4xl font-black text-yellow-900 underline decoration-yellow-100 underline-offset-4">La Griglia</h3>
                            <p className="text-lg font-bold text-yellow-600 leading-tight">Esplora la tavola pitagorica completa.</p>
                            <div className="pt-4"><CartoonButton variant="accent" className="w-full">Vai</CartoonButton></div>
                        </div>
                    </KawaiiCard>

                    <KawaiiCard 
                        onClick={() => { setMode('games_hub'); }}
                        className="border-pink-400 group bg-pink-50/30"
                    >
                        <div className="space-y-4">
                            <div className="w-20 h-20 bg-pink-100 rounded-3xl flex items-center justify-center text-pink-500 border-4 border-pink-400 group-hover:scale-110 transition-transform">
                                <Gamepad2 size={40} />
                            </div>
                            <h3 className="text-4xl font-black text-pink-900 underline decoration-pink-100 underline-offset-4">Gioca</h3>
                            <p className="text-lg font-bold text-pink-600 leading-tight">Mettiti alla prova con tanti giochi!</p>
                            <div className="pt-4"><CartoonButton className="w-full">Pronti?</CartoonButton></div>
                        </div>
                    </KawaiiCard>
                </div>
            </motion.div>
          )}

          {mode === 'stats' && (
             <motion.div key="stats" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <StatsView stats={stats} onBack={() => setMode('study')} onStartExercise={handleStartTargetedExercise} />
             </motion.div>
          )}

          {mode === 'games_hub' && (
            <motion.div key="games" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12 py-10">
                <div className="text-center space-y-4">
                    <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter">Accetta la sfida!</h2>
                    <p className="text-xl font-bold text-slate-400">Tabelline selezionate: {selectedTables.join(', ')}</p>
                </div>

                <div className="bg-white p-8 rounded-[3rem] border-[6px] border-slate-100 shadow-xl max-w-2xl mx-auto flex flex-col items-center gap-6">
                    <h3 className="text-xl font-black text-slate-600 uppercase">Livello di Difficoltà:</h3>
                    <div className="flex flex-wrap justify-center gap-4">
                        {(['facile', 'medio', 'difficile'] as Difficulty[]).map((d) => (
                            <motion.button
                                key={d}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setDifficulty(d)}
                                className={`
                                    px-6 py-3 rounded-2xl font-black text-xl border-4 transition-all uppercase
                                    ${difficulty === d 
                                        ? d === 'facile' ? 'bg-green-500 border-green-700 text-white shadow-[0_4px_0_0_#15803d]' : 
                                          d === 'medio' ? 'bg-yellow-400 border-yellow-600 text-yellow-900 shadow-[0_4px_0_0_#ca8a04]' : 
                                          'bg-rose-500 border-rose-700 text-white shadow-[0_4px_0_0_#be123c]'
                                        : 'bg-white border-slate-200 text-slate-400'}
                                `}
                            >
                                {d}
                            </motion.button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    <KawaiiCard onClick={() => startNewGame('classic')} className="border-pink-400">
                        <div className="flex flex-col items-center text-center gap-4">
                            <Star size={48} className="text-pink-500" />
                            <h4 className="text-2xl font-black">Test Classico</h4>
                            <p className="font-bold text-slate-400">{difficulty === 'facile' ? '10' : difficulty === 'medio' ? '15' : '20'} Domande</p>
                        </div>
                    </KawaiiCard>
                    <KawaiiCard onClick={() => startNewGame('speed')} className="border-yellow-400">
                        <div className="flex flex-col items-center text-center gap-4">
                            <Timer size={48} className="text-yellow-500" />
                            <h4 className="text-2xl font-black">Gara di Velocità</h4>
                            <p className="font-bold text-slate-400">Sii veloce come un fulmine!</p>
                        </div>
                    </KawaiiCard>
                    <KawaiiCard onClick={() => startNewGame('missing')} className="border-sky-400">
                        <div className="flex flex-col items-center text-center gap-4">
                            <Target size={48} className="text-sky-500" />
                            <h4 className="text-2xl font-black">Fattore Mancante</h4>
                            <p className="font-bold text-slate-400">Trova il numero che manca!</p>
                        </div>
                    </KawaiiCard>
                    <KawaiiCard onClick={() => startNewGame('chain')} className="border-purple-400">
                        <div className="flex flex-col items-center text-center gap-4">
                            <Link size={48} className="text-purple-500" />
                            <h4 className="text-2xl font-black">Reazione a Catena</h4>
                            <p className="font-bold text-slate-400">Un calcolo tira l'altro!</p>
                        </div>
                    </KawaiiCard>
                    <KawaiiCard onClick={() => startNewGame('memory')} className="border-orange-400">
                        <div className="flex flex-col items-center text-center gap-4">
                            <Brain size={48} className="text-orange-500" />
                            <h4 className="text-2xl font-black">Memory Match</h4>
                            <p className="font-bold text-slate-400">Allena la tua memoria!</p>
                        </div>
                    </KawaiiCard>
                </div>

                <div className="text-center pt-8">
                    <CartoonButton variant="secondary" onClick={() => setMode('home')}>Indietro</CartoonButton>
                </div>
            </motion.div>
          )}

          {mode === 'study' && (
            <div className="max-w-4xl mx-auto pb-20">
              <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                <h2 className="text-5xl font-black text-slate-800 uppercase">Le Tue Tabelline</h2>
                <CartoonButton variant="accent" onClick={() => setMode('stats')} className="!px-6 !py-3 !text-lg">
                  <Brain size={24} /> Riepilogo Progressi
                </CartoonButton>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {selectedTables.map(t => {
                    const tableColors: Record<number, string> = {
                        1: 'border-red-400 text-red-500 bg-red-50 decoration-red-100 text-red-400',
                        2: 'border-orange-400 text-orange-500 bg-orange-50 decoration-orange-100 text-orange-400',
                        3: 'border-yellow-400 text-yellow-600 bg-yellow-50 decoration-yellow-100 text-yellow-500',
                        4: 'border-lime-400 text-lime-600 bg-lime-50 decoration-lime-100 text-lime-500',
                        5: 'border-green-400 text-green-500 bg-green-50 decoration-green-100 text-green-400',
                        6: 'border-emerald-400 text-emerald-500 bg-emerald-50 decoration-emerald-100 text-emerald-400',
                        7: 'border-teal-400 text-teal-500 bg-teal-50 decoration-teal-100 text-teal-400',
                        8: 'border-sky-400 text-sky-500 bg-sky-50 decoration-sky-100 text-sky-400',
                        9: 'border-indigo-400 text-indigo-500 bg-indigo-50 decoration-indigo-100 text-indigo-400',
                        10: 'border-purple-400 text-purple-500 bg-purple-50 decoration-purple-100 text-purple-400'
                    };
                    const [border, text, bg, deco, accent] = (tableColors[t] || tableColors[8]).split(' ');
                    
                    return (
                        <div key={t} className={`bg-white rounded-[3rem] p-8 border-[6px] ${border} shadow-xl`}>
                            <h3 className={`text-3xl font-black ${text} mb-6 text-center underline decoration-8 ${deco}`}>Tabellina del {t}</h3>
                            <div className="space-y-2">
                                 {TABLES.map(i => (
                                    <div key={i} className={`flex justify-between items-center text-xl font-black px-4 py-2 rounded-xl ${bg} text-slate-800 hover:scale-105 transition-transform`}>
                                        <span className={accent}>{t} × {i}</span>
                                        <span className="text-2xl">= {t * i}</span>
                                    </div>
                                 ))}
                            </div>
                        </div>
                    );
                 })}
              </div>
              <div className="mt-12 text-center">
                    <CartoonButton variant="secondary" onClick={() => setMode('home')}>Torna a Scegliere</CartoonButton>
              </div>
            </div>
          )}

          {mode === 'grid' && (
            <div className="max-w-5xl mx-auto pb-20 space-y-10">
              <div className="text-center space-y-4">
                 <h2 className="text-6xl font-black text-yellow-600 uppercase tracking-tighter">La Tavola Pitagorica</h2>
                 <p className="text-xl font-bold text-slate-400">Tutti i segreti dei numeri in una griglia magica!</p>
              </div>

              <div className="flex justify-center gap-4">
                 <CartoonButton 
                    variant={gridSubMode === 'view' ? 'accent' : 'secondary'} 
                    onClick={() => setGridSubMode('view')}
                    className="!rounded-full !px-8"
                 >
                    👀 Guarda e Studia
                 </CartoonButton>
                 <CartoonButton 
                    variant={gridSubMode === 'complete' ? 'accent' : 'secondary'} 
                    onClick={() => setGridSubMode('complete')}
                    className="!rounded-full !px-8"
                 >
                    ✍️ Completa la Griglia
                 </CartoonButton>
              </div>
              
              <div className="relative overflow-hidden">
                <AnimatePresence mode="wait">
                  {gridSubMode === 'view' ? (
                    <motion.div 
                      key="grid-view"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <MultiplicationGrid />
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="grid-complete"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <InteractiveGrid />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="text-center">
                    <CartoonButton variant="secondary" onClick={() => setMode('home')}>Torna Indietro</CartoonButton>
              </div>
            </div>
          )}

          {mode === 'memory' && (
            <motion.div key="memory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                <h2 className="text-5xl font-black text-center text-orange-500 uppercase">Memory Match</h2>
                <MemoryGame tables={selectedTables} difficulty={difficulty} onComplete={handleMemoryComplete} />
            </motion.div>
          )}

          {mode === 'playing' && game && activeQuestion && (
            <motion.div 
              key="playing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto space-y-8"
            >
                <div className="flex items-center justify-between gap-6 bg-white p-4 rounded-3xl border-4 border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-white border-2 border-yellow-600">
                            <Star size={20} fill="currentColor" />
                        </div>
                        <span className="text-xl font-black">{game.score} Punti</span>
                    </div>
                    
                    {game.type === 'speed' ? (
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border-4 font-black text-2xl ${game.timeLeft < 10 ? 'bg-rose-100 border-rose-500 text-rose-600' : 'bg-slate-100 border-slate-300'}`}>
                            <Timer /> {game.timeLeft}s
                        </div>
                    ) : (
                        <div className="text-xl font-black text-slate-400">
                            Domanda {game.currentIdx + 1} / {game.questions.length}
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-[4rem] p-10 md:p-20 border-[8px] border-pink-500 shadow-2xl relative overflow-hidden">
                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={game.type === 'speed' ? game.score : game.currentIdx}
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="flex flex-col items-center gap-12"
                        >
                             <div className="text-7xl md:text-9xl font-black text-slate-900 tracking-tighter">
                                {activeQuestion.displayOp}
                             </div>

                             <div className={`grid ${
                                game.type === 'speed' ? (game.difficulty === 'facile' ? 'grid-cols-5' : 'grid-cols-4 sm:grid-cols-5 md:grid-cols-10 gap-2') : 
                                game.type === 'chain' ? (game.difficulty === 'facile' ? 'grid-cols-4 gap-4' : 'grid-cols-4 sm:grid-cols-6 md:grid-cols-9 gap-2') :
                                'grid-cols-2 gap-6'} w-full`}>
                                {activeQuestion.options.map((opt, i) => (
                                    <CartoonButton
                                        key={i}
                                        onClick={() => handleAnswer(opt)}
                                        disabled={!!feedback}
                                        variant="secondary"
                                        animate={feedback === 'correct' && opt === activeQuestion.answer ? { 
                                           scale: [1, 1.2, 1],
                                           rotate: [0, 10, -10, 0],
                                           y: [0, -20, 0]
                                        } : {}}
                                        className={`
                                            ${(game.type === 'speed' || game.type === 'chain') ? '!py-4 !px-2 !text-xl !rounded-2xl' : '!py-8 !text-4xl !rounded-[2.5rem]'}
                                            ${feedback === 'correct' && opt === activeQuestion.answer ? '!bg-green-400 !border-green-600 !text-white z-50' : 
                                              feedback === 'wrong' && opt === activeQuestion.answer ? '!bg-green-100 !border-green-400 !text-green-700' :
                                              feedback === 'wrong' && opt !== activeQuestion.answer ? '!bg-rose-50 !border-rose-100 opacity-30' : ''}
                                        `}
                                    >
                                        {opt}
                                    </CartoonButton>
                                ))}
                             </div>
                        </motion.div>
                    </AnimatePresence>

                    <AnimatePresence>
                        {feedback === 'correct' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-green-500 z-40 pointer-events-none">
                                <motion.span 
                                    initial={{ scale: 0.5, rotate: -10 }}
                                    animate={{ scale: [1, 1.5, 1.2], rotate: [0, 5, -5, 0] }}
                                    className="text-8xl font-black uppercase italic tracking-tighter drop-shadow-[0_5px_15px_rgba(34,197,94,0.4)]"
                                >
                                    {feedbackWord}
                                </motion.span>
                            </motion.div>
                        )}
                        {feedback === 'wrong' && (
                            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.5 }} className="absolute inset-0 flex flex-col items-center justify-center bg-rose-500/90 text-white z-40 text-center">
                                <XCircle size={150} className="mx-auto" />
                                <span className="text-4xl font-black mt-4 uppercase">Ops! <br /><span className="text-2xl">Era {activeQuestion.answer}</span></span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
          )}

          {mode === 'result' && game && (
             <motion.div 
                key="result"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl mx-auto text-center"
             >
                <div className="bg-white rounded-[4rem] p-16 border-[10px] border-yellow-400 shadow-2xl space-y-10">
                    <Trophy size={180} className="text-yellow-400 mx-auto" />
                    <div className="space-y-4">
                        <h2 className="text-6xl font-black text-slate-900">MITICO!</h2>
                        <p className="text-2xl font-bold text-slate-400">Hai fatto {game.score} punti!</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
                        <CartoonButton onClick={() => setMode('games_hub')}>Gioca ancora</CartoonButton>
                        <CartoonButton variant="secondary" onClick={() => setMode('home')}>Home</CartoonButton>
                    </div>
                </div>
             </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
        Realizzato con amore per la seconda elementare!
      </footer>
    </div>
  );
}
