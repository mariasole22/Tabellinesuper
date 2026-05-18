const generateQuestion = (tables: number[], type: GameType, difficulty: Difficulty = 'medio', contextValue?: number): Question => {
  const n1 = contextValue ?? (tables[Math.floor(Math.random() * tables.length)]);
  
  let n2;
  if (difficulty === 'facile') {
    n2 = Math.floor(Math.random() * 5) + 1; // 1-5 for Easy
  } else {
    n2 = Math.floor(Math.random() * 10) + 1; // 1-10 for others
  }
  
  const answerValue = n1 * n2;
  
  // Gestione speciale per la modalità "Fattore Mancante"
  if (type === 'missing') {
    const hole = Math.random() > 0.5 ? 1 : 2;
    const displayOp = hole === 1 ? `? × ${n2} = ${answerValue}` : `${n1} × ? = ${answerValue}`;
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
      answer: realAnswer, // La risposta corretta è il fattore mancante
      options: Array.from(optSet).sort(() => Math.random() - 0.5),
      displayOp,
      contextValue: answerValue // Salviamo il prodotto totale come riferimento utile
    };
  }

  // Logica standard per Classic, Speed e Chain
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
        const possibleOffsets = [-2, -1, 1, 2, n1, -n1, 10, -10, 5, -5, 3, -3, 11, -11, 9, -9];
        offset = possibleOffsets[Math.floor(Math.random() * possibleOffsets.length)];
        if (Math.random() > 0.7) offset += (Math.floor(Math.random() * 5) - 2);
    }
    const dist = Math.max(1, answerValue + offset);
    if (dist !== answerValue) optionsSet.add(dist);
  }

  let displayOp = `${n1} × ${n2}`;

  return {
    id: Math.random(),
    num1: n1,
    num2: n2,
    answer: answerValue,
    options: Array.from(optionsSet).sort(() => Math.random() - 0.5),
    displayOp
  };
};
