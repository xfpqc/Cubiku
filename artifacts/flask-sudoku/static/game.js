/**
 * Cubiku — 3D Sudoku frontend
 */

let state    = emptyGrid();    
let clueSet  = new Set();     
let selected = null;          

let activeNumber = null;
let inspectedNumber = null;
let currentDifficulty = "medium"; 
let currentTheme = "cyan";
let stickyKeysEnabled = false; 

let moveHistory = [];

// --- Tutorial State ---
let tutorialMode = false;
let tutorialStep = 0;

const TUT_GRID = [
  [[1,5,9], [6,7,2], [8,3,4]],
  [[4,8,3], [9,1,5], [2,6,7]],
  [[7,2,6], [3,4,8], [5,9,1]]
];

const TUT_HOLES = [
  { z: 0, r: 0, c: 0, val: 1, msg: "Like normal Sudoku, this visible 3x3 slice must contain 1-9. Place the missing number." },
  { z: 1, r: 1, c: 1, val: 1, msg: "Rule 2: Rows cross layers! Look at the middle row cutting through all three grids. Place the missing number." },
  { z: 2, r: 2, c: 2, val: 1, msg: "Rule 3: Columns cross layers too! Look at the highlighted column slicing through the cube. What completes it?" }
];

// --- Stats & Settings State ---
let stats = {
  bestTimes: { easy: null, medium: null, hard: null },
  gamesWon: 0
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
  localStorage.setItem('cubiku_stats', JSON.stringify(stats));
  updateStatsUI();
}

function loadStats() {
  const savedStats = localStorage.getItem('cubiku_stats');
  if (savedStats) {
    try {
      const parsed = JSON.parse(savedStats);
      if (parsed.bestTimes) stats.bestTimes = parsed.bestTimes;
      if (parsed.gamesWon !== undefined) stats.gamesWon = parsed.gamesWon;
    } catch(e) {}
  }
  updateStatsUI();
}

function updateStatsUI() {
  const elWon = document.getElementById('stat-games-won');
  if (elWon) elWon.textContent = stats.gamesWon;
  
  // Update all three difficulty bests at once
  ['easy', 'medium', 'hard'].forEach(diff => {
    const elBest = document.getElementById(`stat-best-${diff}`);
    if (elBest) {
      const best = stats.bestTimes[diff];
      if (best === null) {
        elBest.textContent = "--:--";
      } else {
        const m = String(Math.floor(best / 60)).padStart(2, '0');
        const s = String(best % 60).padStart(2, '0');
        elBest.textContent = `${m}:${s}`;
      }
    }
  });
}

// --- Auto-Save Game State ---
function saveGame() {
  if (clueSet.size === 0) return; // Don't save empty boards
  if (tutorialMode) return; // Don't save tutorial boards

  const saveData = {
    state,
    clues: Array.from(clueSet),
    moveHistory,
    difficulty: currentDifficulty,
    timer: timerSeconds
  };
  localStorage.setItem('cubiku_save', JSON.stringify(saveData));
}

function clearSave() {
  localStorage.removeItem('cubiku_save');
}

function loadGame() {
  const saved = localStorage.getItem('cubiku_save');
  if (!saved) return false;
  
  try {
    const data = JSON.parse(saved);
    state = data.state;
    clueSet = new Set(data.clues);
    moveHistory = data.moveHistory;
    currentDifficulty = data.difficulty;
    timerSeconds = data.timer;
    
    const diffSelect = document.getElementById('difficulty-select');
    if (diffSelect) diffSelect.value = currentDifficulty;
    updateStatsUI(); 
    
    renderState();
    updateDepletion();
    startTimer(); // Will continue from saved timerSeconds
    showMessage('Game resumed.', 'info');
    return true;
  } catch (e) {
    console.error("Save file corrupted, starting fresh.");
    clearSave();
    return false;
  }
}

// --- Tutorial Functions ---
function startTutorial() {
  toggleRules(); 
  tutorialMode = true;
  tutorialStep = 1;
  stopTimer();
  clearSave(); 
  
  state = emptyGrid();
  clueSet = new Set();
  
  // Load the solved matrix, mark all as clues
  for(let z=0; z<3; z++) {
    for(let r=0; r<3; r++) {
      for(let c=0; c<3; c++) {
        state[z][r][c] = TUT_GRID[z][r][c];
        clueSet.add(`${z},${r},${c}`);
      }
    }
  }
  
  // Dig the 3 specific tutorial holes
  TUT_HOLES.forEach(hole => {
    state[hole.z][hole.r][hole.c] = 0;
    clueSet.delete(`${hole.z},${hole.r},${hole.c}`);
  });
  
  renderState();
  updateTutorialUI();
}

function updateTutorialUI() {
  const target = TUT_HOLES[tutorialStep - 1];
  showMessage(target.msg, 'info');
  
  document.querySelectorAll('.cell').forEach(c => {
    c.classList.remove('tutorial-dim', 'tutorial-target');
  });
  
  // Highlight only the relevant spatial plane
  for(let z=0; z<3; z++) {
    for(let r=0; r<3; r++) {
      for(let c=0; c<3; c++) {
        const el = getCell(z,r,c);
        let inPlane = false;
        
        if (tutorialStep === 1 && z === 0) inPlane = true;
        if (tutorialStep === 2 && r === 1) inPlane = true;
        if (tutorialStep === 3 && c === 2) inPlane = true;
        
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
  showMessage("You've mastered the dimensions! Starting your first real game...", "success");
  tutorialMode = false;
  
  setTimeout(() => {
     currentDifficulty = 'easy';
     const diffSelect = document.getElementById('difficulty-select');
     if (diffSelect) diffSelect.value = 'easy';
     newGame();
  }, 3500);
}

// --- End Tutorial Functions ---

function pushHistory(z, row, col, before, after) {
  if (before === after) return;    
  moveHistory.push({ z, row, col, before, after });
  updateUndoButton();
}

function updateUndoButton() {
  const undoBtn = document.getElementById('btn-undo');
  if (undoBtn) undoBtn.disabled = moveHistory.length === 0;
}

function undoMove() {
  if (moveHistory.length === 0) return;
  if (tutorialMode) return; // Prevent undo during tutorial

  const { z, row, col, before } = moveHistory.pop();

  state[z][row][col] = before;

  const el = getCell(z, row, col);
  if (el) {
    el.value = before > 0 ? String(before) : '';
    el.classList.remove('conflict', 'flash-conflict');
  }

  document.querySelectorAll('.cell.conflict').forEach(c => c.classList.remove('conflict'));

  updateUndoButton();
  hideMessage();       
  updateDepletion();   
  updateNumberHighlights();
  saveGame(); 
}

let timerSeconds  = 0;
let timerInterval = null;

function startTimer() {
  stopTimer();
  // We DO NOT reset timerSeconds here because startTimer is used for loading saves too.
  // newGame() manually resets timerSeconds to 0 before calling startTimer().
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimerDisplay();
    if (!tutorialMode) saveGame(); // Auto-saves the timer progression every second
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

function toggleSettings() {
  const panel = document.getElementById('settings-panel');
  if (panel) {
    panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
  }
}

function toggleRules() {
  const modal = document.getElementById('rules-modal');
  if (modal) {
    modal.classList.toggle('hidden');
  }
}

function emptyGrid() {
  return Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, () => Array(3).fill(0))
  );
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
  
  const targetVal = activeNumber !== null ? Number(activeNumber) : (inspectedNumber !== null ? Number(inspectedNumber) : null);
  if (targetVal === null) return;

  for (let z = 0; z < 3; z++) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (state[z][r][c] === targetVal) {
          const el = getCell(z, r, c);
          if (el) {
            el.classList.add('number-highlight');
          }
        }
      }
    }
  }
}

function updateKeyboardUI() {
  document.querySelectorAll('.key-btn').forEach(b => {
    if (b.dataset.val === activeNumber) {
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
        const cell = document.createElement('input');
        cell.type        = 'text';
        cell.inputMode   = 'none';
        cell.maxLength   = 1;
        cell.id          = cellId(z, row, col);
        cell.className   = 'cell';
        cell.dataset.z   = z;
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.setAttribute('aria-label', `Slice z=${z} row ${row + 1} col ${col + 1}`);
        cell.setAttribute('autocomplete', 'off');
        
        cell.addEventListener('focus', onCellFocus);
        cell.addEventListener('input', onCellInput);
        cell.addEventListener('keydown', onCellKeydown);
        cell.addEventListener('pointerdown', onCellPointerDown);

        container.appendChild(cell);
      }
    }
  }
}

function renderState() {
  clearSelection();
  updateUndoButton();

  for (let z = 0; z < 3; z++) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const el     = getCell(z, row, col);
        if (!el) continue;
        const isClue = clueSet.has(`${z},${row},${col}`);
        const val    = state[z][row][col];

        el.value    = val > 0 ? String(val) : '';
        el.readOnly = isClue;
        el.tabIndex = isClue ? -1 : 0;
        el.classList.toggle('clue', isClue);
        el.classList.remove('conflict', 'active-cell', 'constraint-highlight', 'flash-conflict');
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

function fillCell(z, row, col, digitStr) {
  const el = getCell(z, row, col);
  if (!el) return;
  const before = state[z][row][col];
  const after = digitStr ? Number(digitStr) : 0;

  if (before === after) return;

  // --- TUTORIAL INTERCEPT LOGIC ---
  if (tutorialMode) {
    const target = TUT_HOLES[tutorialStep - 1];
    
    // Ignore clicks on wrong cells
    if (z !== target.z || row !== target.r || col !== target.c) return; 
    
    // Check if they placed the right number
    if (after > 0 && after !== target.val) {
      showMessage("Not quite! Look at the highlighted cells. What number from 1-9 is missing?", "error");
      return;
    }
    
    // Correct fill
    el.value = String(after);
    state[z][row][col] = after;
    
    if (after > 0) {
        tutorialStep++;
        if (tutorialStep > 3) {
          endTutorial();
        } else {
          updateTutorialUI();
        }
    }
    return;
  }
  // ---------------------------------

  el.value = digitStr ? String(digitStr) : '';
  state[z][row][col] = after;
  pushHistory(z, row, col, before, after);

  el.classList.remove('conflict', 'flash-conflict');
  hideMessage();

  if (after > 0) {
    flashConflicts(z, row, col, after);
  }

  updateDepletion();
  updateNumberHighlights();
  saveGame(); 
  checkAutoComplete();
}

function updateDepletion() {
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
    if (!btn.dataset.val) return; 
    
    const val = Number(btn.dataset.val);
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
    fillCell(z, row, col, activeNumber);
    
    if (activeNumber === null) return;

    if (!stickyKeysEnabled) {
      activeNumber = null;
      updateKeyboardUI();
      clearSelection();
    } else {
      selectCell(z, row, col);
    }
    updateNumberHighlights();
  } else {
    selectCell(z, row, col);
    el.focus();
  }
}

function onCellInput(e) {
  const el = e.currentTarget;
  const z = Number(el.dataset.z);
  const row = Number(el.dataset.row);
  const col = Number(el.dataset.col);

  if (clueSet.has(`${z},${row},${col}`)) return;

  const digit = el.value.replace(/[^1-9]/g, '').slice(-1);
  fillCell(z, row, col, digit);
  
  if (activeNumber === null) {
    clearSelection();
    el.blur();
  } else {
    updateNumberHighlights();
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

  clearHighlights();
  inspectedNumber = null;

  const btn = document.querySelector(`.key-btn[data-val="${valStr}"]`);
  if (btn && btn.classList.contains('depleted')) return;

  if (selected !== null) {
    const { z, row, col } = selected;
    fillCell(z, row, col, valStr);
    clearSelection(); 
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
  clearSave(); // Wipe out any saved game
  tutorialMode = false; // Ensure we exit tutorial logic

  try {
    const res = await fetch(`/game/new-game?difficulty=${currentDifficulty}`);
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();

    state = emptyGrid();
    clueSet = new Set();
    moveHistory = [];
    timerSeconds = 0; // Reset timer for new game

    for (const [z, row, col, value] of data.clues) {
      state[z][row][col] = value;
      clueSet.add(`${z},${row},${col}`);
    }

    renderState();
    updateDepletion(); 
    startTimer();
    saveGame(); // Save initial state of the new puzzle immediately
    showMessage('New puzzle loaded. Good luck!', 'info');
  } catch (err) {
    showMessage(`Failed to load puzzle: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

async function checkSolution() {
  hideMessage();
  document.querySelectorAll('.cell.conflict').forEach(c => c.classList.remove('conflict'));

  setLoading(true);
  try {
    const res = await fetch('/game/check-solution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grid: state.map(sl => sl.map(r => [...r])) }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();

    if (data.valid) {
      stopTimer();
      showMessage(data.message, 'success');
      clearSelection();
      clearSave(); // Puzzle beaten! Erase save so refresh doesn't reload it
      
      // Update Stats
      stats.gamesWon++;
      const currentBest = stats.bestTimes[currentDifficulty];
      if (currentBest === null || timerSeconds < currentBest) {
        stats.bestTimes[currentDifficulty] = timerSeconds;
      }
      saveStats();

    } else {
      showMessage(data.message, 'error');
      if (Array.isArray(data.conflicts)) {
        data.conflicts.forEach(([z, row, col]) => {
          getCell(z, row, col)?.classList.add('conflict');
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
  buildGrids();
  
  loadPreferences();
  loadStats();
  
  const btnNew = document.getElementById('btn-new-game');
  if (btnNew) btnNew.addEventListener('click', newGame);

  const btnSettings = document.getElementById('btn-settings');
  if (btnSettings) btnSettings.addEventListener('click', toggleSettings);

  const btnUndo = document.getElementById('btn-undo');
  if (btnUndo) btnUndo.addEventListener('click', undoMove);

  const btnZen = document.getElementById('btn-zen');
  if (btnZen) btnZen.addEventListener('click', toggleZen);
  
  const btnInfo = document.getElementById('btn-info');
  if (btnInfo) btnInfo.addEventListener('click', toggleRules);

  const btnCloseRules = document.getElementById('btn-close-rules');
  if (btnCloseRules) btnCloseRules.addEventListener('click', toggleRules);
  
  const btnStartTut = document.getElementById('btn-start-tutorial');
  if (btnStartTut) btnStartTut.addEventListener('click', startTutorial);

  const rulesModal = document.getElementById('rules-modal');
  if (rulesModal) {
    rulesModal.addEventListener('click', (e) => {
      if (e.target === rulesModal) toggleRules();
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

  document.querySelectorAll('.key-btn').forEach(btn => {
    btn.addEventListener('click', (e) => handleKeyboardTap(e.target.dataset.val));
  });

  document.addEventListener('click', (e) => {
    // Close settings panel if clicking outside of it and the settings button
    const settingsPanel = document.getElementById('settings-panel');
    const btnSet = document.getElementById('btn-settings');
    if (settingsPanel && settingsPanel.style.display === 'block') {
      if (!settingsPanel.contains(e.target) && !btnSet.contains(e.target)) {
        settingsPanel.style.display = 'none';
      }
    }

    if (!e.target.closest('#slices-container') && !e.target.closest('.keyboard-container') && !e.target.closest('.top-action-bar')) {
      clearSelection();
    }
  });

  // Attempt to load save, if none exists, fetch a new game
  if (!loadGame()) {
    newGame();
  }
}

document.addEventListener('DOMContentLoaded', init);