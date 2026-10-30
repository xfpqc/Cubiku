/**
 * Cubiku — 3D Sudoku frontend (100% Client-Side Engine)
 */

// ==========================================
// --- THE CUBIKU ENGINE (Ported from Python) ---
// ==========================================

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function isValid(grid, x, y, z, num, n = 3) {
  for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
          if (grid[z][i][j] === num) return false;
          if (grid[i][y][j] === num) return false;
          if (grid[i][j][x] === num) return false;
      }
  }
  return true;
}

function solveAndCount(grid, n = 3, count = { val: 0 }) {
  if (count.val > 1) return;

  for (let z = 0; z < n; z++) {
      for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
              if (grid[z][y][x] === 0) {
                  for (let num = 1; num <= n * n; num++) {
                      if (isValid(grid, x, y, z, num, n)) {
                          grid[z][y][x] = num;
                          solveAndCount(grid, n, count);
                          grid[z][y][x] = 0;
                      }
                  }
                  return;
              }
          }
      }
  }
  count.val += 1;
}

function generateSolvedGrid(grid, n = 3) {
  const cells = [];
  for (let z = 0; z < n; z++) {
      for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
              cells.push({ z, y, x });
          }
      }
  }

  for (const { z, y, x } of cells) {
      if (grid[z][y][x] === 0) {
          let nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
          shuffleArray(nums);

          for (const num of nums) {
              if (isValid(grid, x, y, z, num, n)) {
                  grid[z][y][x] = num;
                  if (generateSolvedGrid(grid, n)) return true;
                  grid[z][y][x] = 0;
              }
          }
          return false;
      }
  }
  return true;
}

function generateUniquePuzzle(n = 3, difficulty = 'medium') {
  const grid = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => Array(n).fill(0))
  );
  
  generateSolvedGrid(grid, n);
  const solvedCopy = JSON.parse(JSON.stringify(grid));

  let cells = [];
  for (let z = 0; z < n; z++) {
      for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
              cells.push({ z, y, x });
          }
      }
  }
  shuffleArray(cells);

  const targetMinClues = difficulty === 'easy' ? 12 : (difficulty === 'medium' ? 10 : 8);
  let currentClues = n * n * n;

  for (const { z, y, x } of cells) {
      if (currentClues <= targetMinClues && difficulty !== 'hard') break;

      const backup = grid[z][y][x];
      grid[z][y][x] = 0;

      const gridCopy = JSON.parse(JSON.stringify(grid));
      const solutions = { val: 0 };
      solveAndCount(gridCopy, n, solutions);

      if (solutions.val !== 1) {
          grid[z][y][x] = backup; 
      } else {
          currentClues--;
      }
  }
  
  const clues = [];
  for (let z = 0; z < n; z++) {
      for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
              const v = grid[z][y][x];
              if (v !== 0) clues.push([z, y, x, v]);
          }
      }
  }
  return { grid, clues, solvedGrid: solvedCopy };
}

function measureHumanDifficulty(grid, n = 3) {
  const testGrid = JSON.parse(JSON.stringify(grid));
  let progress = true;
  const totalCells = n * n * n;
  let initialEmpty = 0;

  for (let z = 0; z < n; z++) {
      for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
              if (testGrid[z][y][x] === 0) initialEmpty++;
          }
      }
  }

  let emptyCount = initialEmpty;

  while (progress && emptyCount > 0) {
      progress = false;
      for (let z = 0; z < n; z++) {
          for (let y = 0; y < n; y++) {
              for (let x = 0; x < n; x++) {
                  if (testGrid[z][y][x] === 0) {
                      const validMoves = [];
                      for (let num = 1; num <= n * n; num++) {
                          if (isValid(testGrid, x, y, z, num, n)) {
                              validMoves.push(num);
                          }
                      }
                      if (validMoves.length === 1) {
                          testGrid[z][y][x] = validMoves[0];
                          emptyCount--;
                          progress = true;
                      }
                  }
              }
          }
      }
  }

  const cluesCount = totalCells - initialEmpty;
  if (cluesCount >= 11 && emptyCount === 0) return "easy";
  if (cluesCount >= 9 && emptyCount <= 3) return "medium";
  return "hard";
}

function generateGame(difficulty = 'medium') {
  let attempts = 0;
  let bestClues = null;
  let bestSolved = null;
  while (attempts < 30) {
      attempts++;
      const { grid, clues, solvedGrid: candidateSolved } = generateUniquePuzzle(3, difficulty);
      bestClues = clues;
      bestSolved = candidateSolved;
      const actualDifficulty = measureHumanDifficulty(grid, 3);
      
      if (actualDifficulty === difficulty) {
          solvedGrid = candidateSolved;
          return clues;
      }
  }
  solvedGrid = bestSolved;
  return bestClues;
}

function check3SSC(grid, n = 3) {
  const conflicts = new Set();
  const addConflict = (z, y, x) => conflicts.add(`${z},${y},${x}`);

  for (let z = 0; z < n; z++) {
      for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
              const v = grid[z][y][x];
              if (typeof v !== 'number' || v < 1 || v > 9) {
                  return {
                      valid: false,
                      message: "Some cells are still empty or contain invalid values.",
                      conflicts: []
                  };
              }
          }
      }
  }

  for (let z = 0; z < n; z++) {
      const seen = {};
      for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
              const num = grid[z][y][x];
              if (!seen[num]) seen[num] = [];
              seen[num].push({ y, x });
          }
      }
      for (const num in seen) {
          if (seen[num].length > 1) {
              seen[num].forEach(({ y, x }) => addConflict(z, y, x));
          }
      }
  }

  for (let y = 0; y < n; y++) {
      const seen = {};
      for (let z = 0; z < n; z++) {
          for (let x = 0; x < n; x++) {
              const num = grid[z][y][x];
              if (!seen[num]) seen[num] = [];
              seen[num].push({ z, x });
          }
      }
      for (const num in seen) {
          if (seen[num].length > 1) {
              seen[num].forEach(({ z, x }) => addConflict(z, y, x));
          }
      }
  }

  for (let x = 0; x < n; x++) {
      const seen = {};
      for (let z = 0; z < n; z++) {
          for (let y = 0; y < n; y++) {
              const num = grid[z][y][x];
              if (!seen[num]) seen[num] = [];
              seen[num].push({ z, y });
          }
      }
      for (const num in seen) {
          if (seen[num].length > 1) {
              seen[num].forEach(({ z, y }) => addConflict(z, y, x));
          }
      }
  }

  if (conflicts.size > 0) {
      return {
          valid: false,
          message: "Some constraints are violated — conflicting cells highlighted.",
          conflicts: Array.from(conflicts).map(c => {
              const [z, y, x] = c.split(',').map(Number);
              return [z, y, x];
          })
      };
  }
  return {
      valid: true,
      message: "Puzzle solved correctly! 🎉",
      conflicts: []
  };
}
// ==========================================
// --- END ENGINE ---
// ==========================================

function emptyGrid() {
  return Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, () => Array(3).fill(0))
  );
}

function emptyDrafts() {
  return Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => new Set()))
  );
}

let state        = emptyGrid();  
let drafts       = emptyDrafts();
let initialGrid  = emptyGrid(); 
let solvedGrid   = null;
let clueSet      = new Set();        
let selected     = null;            
let undoStack    = [];

let activeNumber = null;
let inspectedNumber = null;
let currentDifficulty = "medium"; 
let currentTheme = "cyan";
let stickyKeysEnabled = false; 
let pencilMode = false;
let isGameComplete = false; 

// --- Tutorial State ---
let tutorialMode = false;
let tutorialStep = 0;

const TUT_GRID = [
  [[1,5,9], [6,7,2], [8,3,4]],
  [[4,8,3], [9,1,5], [2,6,7]],
  [[7,2,6], [3,4,8], [5,9,1]]
];

const TUT_HOLES = [
  { z: 0, r: 0, c: 1, val: 5, msg: "Rule 1: Each flat 3x3 slice must contain 1-9. Look at this slice. What number is missing?" },
  { z: 1, r: 1, c: 0, val: 9, msg: "Rule 2: Horizontal rows cross the cube! The highlighted middle row across all slices contains 1-9. Place the missing number." },
  { z: 2, r: 0, c: 2, val: 6, msg: "Rule 3: Vertical columns cross the cube! Check the highlighted right-most column across all slices. Place the final number." }
];

// --- Dynamic Stats Engine ---
let stats = {
  easy:   { wins: 0, bestTime: null, totalTime: 0, lastTime: null },
  medium: { wins: 0, bestTime: null, totalTime: 0, lastTime: null },
  hard:   { wins: 0, bestTime: null, totalTime: 0, lastTime: null }
};

function savePreferences() {
  localStorage.setItem('cubiku_prefs', JSON.stringify({
    theme: currentTheme,
    sticky: stickyKeysEnabled
  }));
}

function loadPreferences() {
  const savedPrefs = localStorage.getItem('cubiku_prefs');
  if (savedPrefs) {
    try {
      const prefs = JSON.parse(savedPrefs);
      currentTheme = prefs.theme || "cyan";
      stickyKeysEnabled = !!prefs.sticky;
      
      document.body.setAttribute('data-theme', currentTheme);
      const themeSelect = document.getElementById('theme-select');
      if (themeSelect) themeSelect.value = currentTheme;
      
      const stickyToggle = document.getElementById('toggle-sticky-keys');
      if (stickyToggle) stickyToggle.checked = stickyKeysEnabled;
    } catch(e) {}
  }
}

function saveStats() {
  localStorage.setItem('cubiku_stats_v2', JSON.stringify(stats));
  updateStatsUI();
}

function loadStats() {
  const savedStatsV2 = localStorage.getItem('cubiku_stats_v2');
  
  if (savedStatsV2) {
    try {
      stats = JSON.parse(savedStatsV2);
    } catch(e) {}
  } else {
    const savedStatsV1 = localStorage.getItem('cubiku_stats');
    if (savedStatsV1) {
      try {
        const parsed = JSON.parse(savedStatsV1);
        if (parsed.bestTimes) {
          ['easy', 'medium', 'hard'].forEach(diff => {
            if (parsed.bestTimes[diff] !== null) {
              stats[diff].bestTime = parsed.bestTimes[diff];
              stats[diff].lastTime = parsed.bestTimes[diff];
              stats[diff].wins = 1;
              stats[diff].totalTime = parsed.bestTimes[diff];
            }
          });
        }
      } catch(e) {}
    }
  }
  updateStatsUI();
}

function resetStats() {
  const diff = (currentDifficulty === 'custom') ? 'medium' : currentDifficulty;
  const capitalizedDiff = diff.charAt(0).toUpperCase() + diff.slice(1);
  
  if (confirm(`Are you sure you want to erase your statistics for ${capitalizedDiff} mode? This cannot be undone.`)) {
    stats[diff] = { wins: 0, bestTime: null, totalTime: 0, lastTime: null };
    saveStats();
    showMessage(`${capitalizedDiff} statistics reset.`, "info");
    
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel) settingsPanel.style.display = 'none';
  }
}

function formatTime(seconds) {
  if (seconds === null || seconds === undefined) return "--:--";
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

function updateStatsUI() {
  const diff = currentDifficulty === 'custom' ? 'medium' : currentDifficulty;
  const currentStats = stats[diff] || stats['medium'];

  const elWins = document.getElementById('stat-wins');
  if (elWins) elWins.textContent = currentStats.wins;

  const elBest = document.getElementById('stat-best');
  if (elBest) elBest.textContent = formatTime(currentStats.bestTime);

  const elAvg = document.getElementById('stat-avg');
  if (elAvg) {
    const avg = currentStats.wins > 0 ? Math.floor(currentStats.totalTime / currentStats.wins) : null;
    elAvg.textContent = formatTime(avg);
  }

  const elLast = document.getElementById('stat-last');
  if (elLast) elLast.textContent = formatTime(currentStats.lastTime);
}

function saveGame() {
  if (clueSet.size === 0) return; 
  if (tutorialMode) return; 

  const saveData = {
    state,
    drafts: drafts.map(zLevel => zLevel.map(row => row.map(cellSet => Array.from(cellSet)))),
    initialGrid,
    solvedGrid,
    clues: Array.from(clueSet),
    difficulty: currentDifficulty,
    timer: timerSeconds
  };
  localStorage.setItem('cubiku_save', JSON.stringify(saveData));
}

function clearSave() {
  localStorage.removeItem('cubiku_save');
}

function computeSolutionGrid() {
  const grid = emptyGrid();
  for (let z = 0; z < 3; z++) {
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        if (initialGrid[z][y][x] > 0) {
          grid[z][y][x] = initialGrid[z][y][x];
        }
      }
    }
  }
  const solved = JSON.parse(JSON.stringify(grid));
  solveGridHelper(solved, 3);
  return solved;
}

function solveGridHelper(grid, n = 3) {
  for (let z = 0; z < n; z++) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (grid[z][y][x] === 0) {
          for (let num = 1; num <= n * n; num++) {
            if (isValid(grid, x, y, z, num, n)) {
              grid[z][y][x] = num;
              if (solveGridHelper(grid, n)) return true;
              grid[z][y][x] = 0;
            }
          }
          return false;
        }
      }
    }
  }
  return true;
}

function loadGame() {
  const saved = localStorage.getItem('cubiku_save');
  if (!saved) return false;
  
  try {
    const data = JSON.parse(saved);
    state = data.state;
    
    if (data.drafts) {
        drafts = data.drafts.map(zLevel => 
            zLevel.map(row => row.map(cellArray => new Set(cellArray)))
        );
    } else {
        drafts = emptyDrafts();
    }

    initialGrid = data.initialGrid || emptyGrid();
    solvedGrid = data.solvedGrid || computeSolutionGrid();
    clueSet = new Set(data.clues);
    currentDifficulty = data.difficulty;
    timerSeconds = data.timer;
    undoStack = [];
    isGameComplete = false; 
    document.querySelectorAll('.key-btn').forEach(btn => btn.classList.remove('control-disabled'));
    
    const diffSelect = document.getElementById('difficulty-select');
    if (diffSelect) diffSelect.value = currentDifficulty;
    updateStatsUI(); 
    
    renderState();
    updateDepletion();
    startTimer(); 
    showMessage('Game resumed.', 'info');
    return true;
  } catch (e) {
    clearSave();
    return false;
  }
}

function startTutorial() {
  const settingsPanel = document.getElementById('settings-panel');
  if (settingsPanel) settingsPanel.style.display = 'none';

  tutorialMode = true;
  tutorialStep = 1;
  stopTimer();
  clearSave(); 
  
  state = emptyGrid();
  drafts = emptyDrafts();
  clueSet = new Set();
  undoStack = [];
  isGameComplete = false; 
  document.querySelectorAll('.key-btn').forEach(btn => btn.classList.remove('control-disabled'));
  
  for(let z=0; z<3; z++) {
    for(let r=0; r<3; r++) {
      for(let c=0; c<3; c++) {
        state[z][r][c] = TUT_GRID[z][r][c];
        clueSet.add(`${z},${r},${c}`);
      }
    }
  }
  
  TUT_HOLES.forEach(hole => {
    state[hole.z][hole.r][hole.c] = 0;
    clueSet.delete(`${hole.z},${hole.r},${hole.c}`);
  });
  
  solvedGrid = JSON.parse(JSON.stringify(TUT_GRID));
  renderState();
  updateDepletion();
  updateTutorialUI();
  clearSelection();
}

function updateTutorialUI() {
  const target = TUT_HOLES[tutorialStep - 1];
  showMessage(target.msg, 'info');
  
  document.querySelectorAll('.cell').forEach(c => {
    c.classList.remove('tutorial-dim', 'tutorial-target');
  });
  
  for(let z=0; z<3; z++) {
    for(let r=0; r<3; r++) {
      for(let c=0; c<3; c++) {
        const el = getCell(z,r,c);
        let inPlane = false;
        
        if (tutorialStep === 1 && z === target.z) inPlane = true;
        if (tutorialStep === 2 && r === target.r) inPlane = true;
        if (tutorialStep === 3 && c === target.c) inPlane = true;
        
        if (!inPlane) {
          el.classList.add('tutorial-dim');
        }
        if (z === target.z && r === target.r && c === target.c) {
          el.classList.add('tutorial-target');
        }
      }
    }
  }
}

function endTutorial() {
  document.querySelectorAll('.cell').forEach(c => c.classList.remove('tutorial-dim', 'tutorial-target'));
  document.querySelectorAll('.key-btn').forEach(btn => {
    btn.style.opacity = '1';
    btn.style.textDecoration = 'none';
    btn.classList.remove('depleted');
  });
  
  showMessage("Tutorial complete! 🎉", "success");
  
  const isStartingTutorial = !localStorage.getItem('cubiku_tutorial_complete');
  
  if (isStartingTutorial) {
    localStorage.setItem('cubiku_tutorial_complete', 'true');
    tutorialMode = false;
    
    setTimeout(() => {
       currentDifficulty = 'easy';
       const diffSelect = document.getElementById('difficulty-select');
       if (diffSelect) diffSelect.value = 'easy';
       updateStatsUI();
       newGame();
    }, 15000); 
  } else {
    tutorialMode = false;
  }
}

let timerSeconds  = 0;
let timerInterval = null;

function startTimer() {
  stopTimer();
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimerDisplay();
    if (!tutorialMode) saveGame(); 
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  const display = document.getElementById('timer-display');
  if (!display) return;
  const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const s = String(timerSeconds % 60).padStart(2, '0');
  display.textContent = `${m}:${s}`;
}

let zenMode = false;

function toggleZen() {
  zenMode = !zenMode;
  const timerBar = document.getElementById('timer-bar');
  if (timerBar) timerBar.classList.toggle('zen', zenMode);
  
  const eyeOpen = document.getElementById('icon-eye-open');
  const eyeClosed = document.getElementById('icon-eye-closed');
  if (eyeOpen) eyeOpen.style.display = zenMode ? 'none' : '';
  if (eyeClosed) eyeClosed.style.display = zenMode ? '' : 'none';
  
  const btnZen = document.getElementById('btn-zen');
  if (btnZen) {
    btnZen.title = zenMode ? 'Zen Mode — show timer' : 'Zen Mode — hide timer';
  }
}

function toggleMenu() {
  const panel = document.getElementById('settings-panel');
  if (panel) {
    panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'flex' : 'none';
  }
}

function toggleRules() {
  const modal = document.getElementById('rules-modal');
  if (modal) {
    modal.classList.toggle('hidden');
  }
}

function cellId(z, row, col) { return `cell-${z}-${row}-${col}`; }
function getCell(z, row, col) { return document.getElementById(cellId(z, row, col)); }

function showMessage(text, type = 'info') {
  const bar = document.getElementById('message-bar');
  if (!bar) return;
  bar.textContent = text;
  bar.className   = `message-bar ${type}`;
}

function hideMessage() {
  const bar = document.getElementById('message-bar');
  if (bar) bar.className = 'message-bar hidden';
}

function clearHighlights() {
  document.querySelectorAll('.cell.active-cell, .cell.constraint-highlight')
    .forEach(el => el.classList.remove('active-cell', 'constraint-highlight'));
}

function applyCrosshair(selZ, selRow, selCol) {
  for (let z = 0; z < 3; z++) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (r !== selRow && c !== selCol) continue;
        const el = getCell(z, r, c);
        if (!el) continue;
        if (z === selZ && r === selRow && c === selCol) {
          el.classList.add('active-cell');
        } else {
          el.classList.add('constraint-highlight');
        }
      }
    }
  }
}

function selectCell(z, row, col) {
  if (tutorialMode) {
    const target = TUT_HOLES[tutorialStep - 1];
    if (z !== target.z || row !== target.r || col !== target.c) return;
  }

  clearHighlights();
  inspectedNumber = null;
  selected = clueSet.has(`${z},${row},${col}`) ? null : { z, row, col };
  applyCrosshair(z, row, col);
  updateNumberHighlights();
}

function clearSelection() {
  clearHighlights();
  selected = null;
  inspectedNumber = null;
  updateNumberHighlights();
}

function updateNumberHighlights() {
  document.querySelectorAll('.cell').forEach(el => el.classList.remove('number-highlight'));
  
  const targetVal = activeNumber !== null && activeNumber !== 'erase' && activeNumber !== 'undo' && activeNumber !== 'pencil' 
                    ? Number(activeNumber) : (inspectedNumber !== null ? Number(inspectedNumber) : null);
  if (targetVal === null) return;

  for (let z = 0; z < 3; z++) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (state[z][r][c] === targetVal) {
          const el = getCell(z, r, c);
          if (el) el.classList.add('number-highlight');
        }
      }
    }
  }
}

function updateKeyboardUI() {
  document.querySelectorAll('.key-btn').forEach(b => {
    const val = b.dataset.val;
    
    if (val === 'pencil') {
       b.classList.toggle('active', pencilMode);
       return;
    }

    if (val === activeNumber) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
    b.style.transform = '';
    b.style.fontWeight = '';
    b.style.border = '';
  });
}

function buildGrids() {
  for (let z = 0; z < 3; z++) {
    const container = document.getElementById(`grid-z${z}`);
    if (!container) continue;
    container.innerHTML = '';

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const cell = document.createElement('div');
        cell.id          = cellId(z, row, col);
        cell.className   = 'cell';
        cell.dataset.z   = z;
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.tabIndex    = 0;
        cell.setAttribute('aria-label', `Slice z=${z} row ${row + 1} col ${col + 1}`);

        const mainVal = document.createElement('span');
        mainVal.className = 'main-value';
        cell.appendChild(mainVal);

        for (let i = 1; i <= 9; i++) {
            const cand = document.createElement('span');
            cand.className = `candidate cand-${i}`;
            cand.textContent = i;
            cell.appendChild(cand);
        }

        cell.addEventListener('focus', onCellFocus);
        cell.addEventListener('keydown', onCellKeydown);
        cell.addEventListener('pointerdown', onCellPointerDown);

        container.appendChild(cell);
      }
    }
  }
}

function renderState() {
  for (let z = 0; z < 3; z++) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const el = getCell(z, row, col);
        if (!el) continue;
        const isClue = clueSet.has(`${z},${row},${col}`);
        const val = state[z][row][col];
        const cellDrafts = drafts[z][row][col];

        el.tabIndex = isClue ? -1 : 0;
        el.classList.toggle('clue', isClue);
        el.classList.remove('conflict', 'flash-conflict', 'tutorial-dim', 'tutorial-target');

        const mainValSpan = el.querySelector('.main-value');
        
        if (val > 0) {
            el.classList.remove('draft-mode');
            if (mainValSpan) mainValSpan.textContent = val;
        } else {
            if (mainValSpan) mainValSpan.textContent = '';
            if (cellDrafts && cellDrafts.size > 0) {
                el.classList.add('draft-mode');
                for (let i = 1; i <= 9; i++) {
                    const cand = el.querySelector(`.cand-${i}`);
                    if (cand) cand.classList.toggle('visible', cellDrafts.has(i));
                }
            } else {
                el.classList.remove('draft-mode');
            }
        }
      }
    }
  }
  updateNumberHighlights();
}

function setLoading(on) {
  document.querySelectorAll('.grid').forEach(g => g.classList.toggle('loading', on));
  const newGameBtn = document.getElementById('btn-new-game');
  if (newGameBtn) newGameBtn.disabled = on;
}

function undoLastAction() {
  if (isGameComplete || undoStack.length === 0) return;
  const action = undoStack.pop();

  if (action.type === 'auto_draft_clear') {
      action.cells.forEach(({z: az, r: ar, c: ac}) => {
          drafts[az][ar][ac].add(action.digit);
      });
      undoLastAction();
      return; 
  }

  const el = getCell(action.z, action.row, action.col);
  if (!el) return;

  if (action.type === 'draft') {
      drafts[action.z][action.row][action.col] = action.before;
  } else if (action.type === 'value') {
      state[action.z][action.row][action.col] = action.before;
  } else if (action.type === 'clear') {
      state[action.z][action.row][action.col] = action.beforeVal;
      drafts[action.z][action.row][action.col] = action.beforeDrafts;
  } else {
      state[action.z][action.row][action.col] = action.before;
  }

  el.classList.remove('conflict', 'flash-conflict');

  updateDepletion();
  saveGame();
  renderState();
  checkAutoComplete();
}

function removeDraftFromPeers(z, row, col, digit) {
    const affected = [];
    for (let i = 0; i < 3; i++) {
        if (i !== col && drafts[z][row][i].has(digit)) affected.push({z, r: row, c: i});
        if (i !== row && drafts[z][i][col].has(digit)) affected.push({z, r: i, c: col});
        if (i !== z && drafts[i][row][col].has(digit)) affected.push({z: i, r: row, c: col});
    }
    
    if (affected.length > 0) {
        undoStack.push({ type: 'auto_draft_clear', digit, cells: affected });
        affected.forEach(({z: az, r: ar, c: ac}) => {
            drafts[az][ar][ac].delete(digit);
        });
    }
}

function fillCell(z, row, col, digitStr) {
  if (isGameComplete) return; 
  if (clueSet.has(`${z},${row},${col}`)) return;

  const el = getCell(z, row, col);
  if (!el) return;
  const digit = digitStr ? Number(digitStr) : 0;
  const beforeVal = state[z][row][col];
  const beforeDrafts = new Set(drafts[z][row][col]);

  if (tutorialMode) {
    const target = TUT_HOLES[tutorialStep - 1];
    if (z !== target.z || row !== target.r || col !== target.c) return; 
    
    if (digit > 0 && digit !== target.val) {
      showMessage(`Not quite! Look at the highlighted cells. The correct number is ${target.val}.`, "error");
      return;
    }
    
    state[z][row][col] = digit;
    
    if (digit > 0) {
        tutorialStep++;
        if (tutorialStep > 3) {
          endTutorial();
        } else {
          updateTutorialUI();
        }
    }
    renderState();
    return;
  }

  if (digitStr === '') {
      undoStack.push({ type: 'clear', z, row, col, beforeVal, beforeDrafts });
      state[z][row][col] = 0;
      drafts[z][row][col].clear();
      hideMessage();
      updateDepletion();
      saveGame();
      renderState();
      return;
  }

  if (pencilMode && state[z][row][col] === 0) {
      undoStack.push({ type: 'draft', z, row, col, before: beforeDrafts });
      if (drafts[z][row][col].has(digit)) {
          drafts[z][row][col].delete(digit);
      } else {
          drafts[z][row][col].add(digit);
      }
      saveGame();
      renderState();
      return;
  }

  if (beforeVal === digit && !pencilMode) return;

  undoStack.push({ type: 'value', z, row, col, before: beforeVal });
  state[z][row][col] = digit;
  
  if (digit > 0) {
      drafts[z][row][col].clear();
      removeDraftFromPeers(z, row, col, digit);
      flashConflicts(z, row, col, digit);
  }

  hideMessage();
  updateDepletion();
  saveGame(); 
  renderState();
  checkAutoComplete();
}

function updateDepletion() {
  if (tutorialMode) {
    document.querySelectorAll('.key-btn').forEach(btn => {
      btn.style.opacity = '1';
      btn.style.textDecoration = 'none';
      btn.classList.remove('depleted');
    });
    return;
  }

  const counts = Array(10).fill(0);
  for (let z = 0; z < 3; z++) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const val = state[z][r][c];
        if (val > 0) counts[val]++;
      }
    }
  }

  let activeWasDepleted = false;

  document.querySelectorAll('.key-btn').forEach(btn => {
    const valStr = btn.dataset.val;
    
    // EXPLICIT PROTECTION: Force tool buttons to stay fully active forever
    if (!valStr || ['erase', 'undo', 'pencil'].includes(valStr)) {
      btn.style.opacity = '1';
      btn.style.textDecoration = 'none';
      btn.classList.remove('depleted');
      return; 
    }
    
    const val = Number(valStr);
    if (counts[val] >= 3) {
      btn.style.opacity = '0.3';
      btn.style.textDecoration = 'line-through';
      btn.classList.add('depleted');
      btn.classList.remove('active');

      if (activeNumber === String(val)) {
        activeNumber = null;
        activeWasDepleted = true;
      }
    } else {
      btn.style.opacity = '1';
      btn.style.textDecoration = 'none';
      btn.classList.remove('depleted');
    }
  });

  if (activeWasDepleted) {
    updateKeyboardUI();
    clearSelection();
    if (document.activeElement && document.activeElement.classList.contains('cell')) {
      document.activeElement.blur();
    }
    updateNumberHighlights();
  }
}

function checkAutoComplete() {
  let emptyCount = 0;
  for (let z = 0; z < 3; z++) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (state[z][r][c] === 0) emptyCount++;
      }
    }
  }
  
  if (emptyCount === 0) {
    checkSolution(); 
  }
}

function flashConflicts(z, row, col, value) {
  if (!value) return;
  const clashEls = [];

  for (let c = 0; c < 3; c++) {
    if (c !== col && state[z][row][c] === value) clashEls.push(getCell(z, row, c));
  }
  for (let r = 0; r < 3; r++) {
    if (r !== row && state[z][r][col] === value) clashEls.push(getCell(z, row, col));
  }
  for (let oz = 0; oz < 3; oz++) {
    if (oz !== z && state[oz][row][col] === value) clashEls.push(getCell(oz, row, col));
  }

  clashEls.forEach(el => {
    if(!el) return;
    el.classList.remove('flash-conflict');
    void el.offsetWidth;
    el.classList.add('flash-conflict');
    setTimeout(() => el.classList.remove('flash-conflict'), 1000);
  });
}

function onCellFocus(e) {
  const el = e.currentTarget;
  const z = Number(el.dataset.z);
  const row = Number(el.dataset.row);
  const col = Number(el.dataset.col);

  if (clueSet.has(`${z},${row},${col}`)) {
    el.blur();
    return;
  }

  if (activeNumber === null && !selected && inspectedNumber === null) {
    selectCell(z, row, col);
  }
}

function onCellPointerDown(e) {
  e.preventDefault(); 
  
  const el = e.currentTarget;
  const z = Number(el.dataset.z);
  const row = Number(el.dataset.row);
  const col = Number(el.dataset.col);
  
  if (inspectedNumber !== null) {
    inspectedNumber = null;
    clearHighlights();
  }

  if (clueSet.has(`${z},${row},${col}`)) {
    inspectedNumber = String(state[z][row][col]);
    activeNumber = null; 
    updateKeyboardUI();
    updateNumberHighlights();
    clearHighlights();
    applyCrosshair(z, row, col);
    selected = null;
    return;
  }

  if (activeNumber !== null) {
    if (activeNumber === 'erase') {
      fillCell(z, row, col, '');
    } else {
      fillCell(z, row, col, activeNumber);
    }
    
    // Deselect if Sticky is OFF. DO NOT touch pencilMode state here.
    if (!stickyKeysEnabled) {
      activeNumber = null;
      clearSelection();
    } else {
      selectCell(z, row, col);
    }
    
    updateKeyboardUI();
    updateNumberHighlights();
  } else {
    selectCell(z, row, col);
    el.focus();
  }
}

function onCellKeydown(e) {
  const el = e.currentTarget;
  const z = Number(el.dataset.z);
  const row = Number(el.dataset.row);
  const col = Number(el.dataset.col);

  if (e.key === 'Backspace' || e.key === 'Delete') {
    if (!clueSet.has(`${z},${row},${col}`)) {
      e.preventDefault();
      fillCell(z, row, col, '');
    }
    return;
  }

  if (/^[1-9]$/.test(e.key)) {
    if (!clueSet.has(`${z},${row},${col}`)) {
      e.preventDefault();
      fillCell(z, row, col, e.key);
      
      // Deselect if Sticky is OFF. DO NOT touch pencilMode state.
      if (!stickyKeysEnabled) {
        updateKeyboardUI();
        clearSelection();
      }
    }
    return;
  }

  if (e.key.toLowerCase() === 'p') {
      e.preventDefault();
      pencilMode = !pencilMode;
      updateKeyboardUI();
      return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      undoLastAction();
      return;
  }

  if (e.key === 'Escape') { clearSelection(); el.blur(); return; }

  const moves = {
    ArrowRight: [z, row, (col + 1) % 3],
    ArrowLeft:  [z, row, (col + 2) % 3],
    ArrowDown:  [z, (row + 1) % 3, col],
    ArrowUp:    [z, (row + 2) % 3, col],
  };
  if (moves[e.key]) {
    e.preventDefault();
    const [nz, nr, nc] = moves[e.key];
    getCell(nz, nr, nc)?.focus();
    selectCell(nz, nr, nc);
  }
}

function handleKeyboardTap(valStr) {
  if (!valStr) return; 

  if (valStr === 'undo') {
    undoLastAction();
    return;
  }
  
  if (valStr === 'pencil') {
    pencilMode = !pencilMode;
    updateKeyboardUI();
    return; 
  }

  clearHighlights();
  inspectedNumber = null;

  if (valStr !== 'erase') {
    const btn = document.querySelector(`.key-btn[data-val="${valStr}"]`);
    if (btn && btn.classList.contains('depleted')) return;
  }

  if (selected !== null) {
    const { z, row, col } = selected;

    if (valStr === 'erase') {
      if (!clueSet.has(`${z},${row},${col}`)) fillCell(z, row, col, '');
    } else {
      fillCell(z, row, col, valStr);
    }
    
    // Deselect if Sticky is OFF. DO NOT touch pencilMode state.
    if (!stickyKeysEnabled) {
        activeNumber = null;
        clearSelection(); 
    } else {
        selectCell(z, row, col); 
    }
    
    updateKeyboardUI();
    updateNumberHighlights();
  } else {
    if (activeNumber === valStr) {
      activeNumber = null;
    } else {
      activeNumber = valStr;
    }
    updateKeyboardUI();
    updateNumberHighlights();
  }
}

async function newGame() {
  setLoading(true);
  hideMessage();
  stopTimer();
  clearSave();
  clearSelection();
  tutorialMode = false;
  isGameComplete = false; 
  document.querySelectorAll('.key-btn').forEach(btn => btn.classList.remove('control-disabled'));

  document.querySelectorAll('.cell').forEach(c => {
    c.classList.remove('tutorial-dim', 'tutorial-target');
  });

  await new Promise(resolve => setTimeout(resolve, 50));

  try {
    const clues = generateGame(currentDifficulty);

    state = emptyGrid();
    drafts = emptyDrafts();
    initialGrid = emptyGrid();
    clueSet = new Set();
    undoStack = [];
    timerSeconds = 0; 

    for (const [z, row, col, value] of clues) {
      state[z][row][col] = value;
      initialGrid[z][row][col] = value;
      clueSet.add(`${z},${row},${col}`);
    }

    renderState();
    updateDepletion(); 
    startTimer();
    saveGame(); 
    showMessage('New puzzle loaded. Good luck!', 'info');
  } catch (err) {
    showMessage(`Failed to load puzzle: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

function loadGameFromSeed(seedStr, difficultyStr) {
    setLoading(true);
    state = emptyGrid();
    drafts = emptyDrafts();
    initialGrid = emptyGrid();
    clueSet = new Set();
    undoStack = [];
    timerSeconds = 0;
    isGameComplete = false;
    clearSelection(); 
    document.querySelectorAll('.key-btn').forEach(btn => btn.classList.remove('control-disabled'));
    currentDifficulty = difficultyStr || 'custom';
    
    let index = 0;
    for (let z = 0; z < 3; z++) {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          let val = parseInt(seedStr[index], 10);
          if (val > 0) {
            state[z][row][col] = val;
            initialGrid[z][row][col] = val;
            clueSet.add(`${z},${row},${col}`);
          }
          index++;
        }
      }
    }
    
    solvedGrid = computeSolutionGrid();
    const diffSelect = document.getElementById('difficulty-select');
    if (diffSelect) diffSelect.value = currentDifficulty;
    updateStatsUI();
    
    renderState();
    updateDepletion();
    startTimer();
    setLoading(false);
    saveGame();
    showMessage('Shared puzzle loaded!', 'info');
}

async function checkSolution() {
  if (isGameComplete) return; 

  hideMessage();
  document.querySelectorAll('.cell.conflict').forEach(c => c.classList.remove('conflict'));

  setLoading(true);
  
  await new Promise(resolve => setTimeout(resolve, 50));

  try {
    const data = check3SSC(state);

    if (data.valid) {
      isGameComplete = true; 
      document.querySelectorAll('.key-btn').forEach(btn => btn.classList.add('control-disabled')); 

      stopTimer();
      showMessage(data.message, 'success');
      clearSelection();
      clearSave(); 
      
      const diff = (currentDifficulty === 'custom') ? 'medium' : currentDifficulty;
      stats[diff].wins++;
      stats[diff].totalTime += timerSeconds;
      stats[diff].lastTime = timerSeconds;
      
      if (stats[diff].bestTime === null || timerSeconds < stats[diff].bestTime) {
        stats[diff].bestTime = timerSeconds;
      }
      saveStats();

    } else {
      showMessage(data.message, 'error');
      if (!solvedGrid) solvedGrid = computeSolutionGrid();
      if (Array.isArray(data.conflicts)) {
        data.conflicts.forEach(([z, row, col]) => {
          if (!clueSet.has(`${z},${row},${col}`) && state[z][row][col] !== solvedGrid[z][row][col]) {
            getCell(z, row, col)?.classList.add('conflict');
          }
        });
      }
    }
  } catch (err) {
    showMessage(`Could not check solution: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

function init() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(persistent => {
      console.log(persistent ? "Storage is persistent." : "Storage is temporary.");
    });
  }

  buildGrids();
  
  loadPreferences();
  loadStats();
  
  const btnNew = document.getElementById('btn-new-game');
  if (btnNew) btnNew.addEventListener('click', newGame);

  const btnMenu = document.getElementById('btn-menu');
  if (btnMenu) btnMenu.addEventListener('click', toggleMenu);

  const btnRestart = document.getElementById('btn-restart');
  if (btnRestart) btnRestart.addEventListener('click', () => {
      if (confirm("Are you sure you want to restart this puzzle from the beginning?")) {
          for (let z = 0; z < 3; z++) {
              for (let y = 0; y < 3; y++) {
                  for (let x = 0; x < 3; x++) {
                      state[z][y][x] = initialGrid[z][y][x];
                  }
              }
          }
          undoStack = [];
          drafts = emptyDrafts();
          isGameComplete = false; 
          document.querySelectorAll('.key-btn').forEach(btn => btn.classList.remove('control-disabled'));
          timerSeconds = 0;
          renderState();
          updateDepletion();
          startTimer();
          saveGame();
          showMessage("Puzzle restarted.", "info");
      }
  });

  const btnZen = document.getElementById('btn-zen');
  if (btnZen) btnZen.addEventListener('click', toggleZen);
  
  const btnSettingsTut = document.getElementById('btn-settings-tutorial');
  if (btnSettingsTut) {
      btnSettingsTut.addEventListener('click', () => {
          document.getElementById('settings-panel').style.display = 'none';
          startTutorial();
      });
  }

  const btnSettingsReset = document.getElementById('btn-settings-reset-stats');
  if (btnSettingsReset) {
      btnSettingsReset.addEventListener('click', (e) => {
          e.stopPropagation();
          resetStats();
      });
  }

  const markTutorialComplete = () => {
      localStorage.setItem('cubiku_tutorial_complete', 'true');
      toggleRules();
  };

  const btnStartTut = document.getElementById('btn-start-tutorial');
  if (btnStartTut) {
      btnStartTut.addEventListener('click', () => {
          markTutorialComplete();
          startTutorial();
      });
  }

  const btnSkipTut = document.getElementById('btn-skip-tutorial');
  if (btnSkipTut) btnSkipTut.addEventListener('click', markTutorialComplete);

  const btnCloseRules = document.getElementById('btn-close-rules');
  if (btnCloseRules) btnCloseRules.addEventListener('click', markTutorialComplete);

  const rulesModal = document.getElementById('rules-modal');
  if (rulesModal) {
    rulesModal.addEventListener('click', (e) => {
      if (e.target === rulesModal) markTutorialComplete();
    });
  }
  
  const diffSelect = document.getElementById('difficulty-select');
  if (diffSelect) {
    diffSelect.addEventListener('change', (e) => {
      currentDifficulty = e.target.value;
      updateStatsUI();
    });
  }

  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      currentTheme = e.target.value;
      document.body.setAttribute('data-theme', currentTheme);
      updateNumberHighlights();
      savePreferences();
    });
  }

  const toggleSticky = document.getElementById('toggle-sticky-keys');
  if (toggleSticky) {
    toggleSticky.addEventListener('change', (e) => {
      stickyKeysEnabled = e.target.checked;
      savePreferences();
    });
  }

  document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
          e.preventDefault();
          undoLastAction();
      }
  });

  document.querySelectorAll('.key-btn').forEach(btn => {
    btn.addEventListener('click', (e) => handleKeyboardTap(e.currentTarget.dataset.val));
  });

  document.addEventListener('click', (e) => {
    const settingsPanel = document.getElementById('settings-panel');
    const btnM = document.getElementById('btn-menu');
    if (settingsPanel && settingsPanel.style.display === 'flex') {
      if (!settingsPanel.contains(e.target) && !btnM.contains(e.target)) {
        settingsPanel.style.display = 'none';
      }
    }

    if (!e.target.closest('#slices-container') && !e.target.closest('.keyboard-container') && !e.target.closest('.top-action-bar')) {
      clearSelection();
    }
  });

  const urlParams = new URLSearchParams(window.location.search);
  const boardSeed = urlParams.get('b');
  const difficultySeed = urlParams.get('d');

  if (boardSeed && boardSeed.length === 27 && /^\d+$/.test(boardSeed)) {
      loadGameFromSeed(boardSeed, difficultySeed);
      window.history.replaceState({}, document.title, window.location.pathname); 
  } else if (!loadGame()) {
      newGame();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();

  const tutorialCompleted = localStorage.getItem('cubiku_tutorial_complete');
  
  if (!tutorialCompleted) {
    const rulesModal = document.getElementById('rules-modal');
    if (rulesModal) {
      rulesModal.classList.remove('hidden');
    }
  }
});