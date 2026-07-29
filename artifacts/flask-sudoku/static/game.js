/**
 * Cubiku — 3D Sudoku frontend
 */

let state    = emptyGrid();    
let clueSet  = new Set();     
let selected = null;          

let activeNumber = null;
let currentDifficulty = "medium"; 
let currentTheme = "gold";
let stickyKeysEnabled = false; // Set to true to make keypad numbers stay active after placing

let moveHistory = [];

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
}

let timerSeconds  = 0;
let timerInterval = null;

function startTimer() {
  stopTimer();
  timerSeconds = 0;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimerDisplay();
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

// Rules Modal Toggle
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
  clearHighlights();
  selected = clueSet.has(`${z},${row},${col}`) ? null : { z, row, col };
  applyCrosshair(z, row, col);
  updateNumberHighlights();
}

function clearSelection() {
  clearHighlights();
  selected = null;
  updateNumberHighlights();
}

function updateNumberHighlights() {
  document.querySelectorAll('.cell').forEach(el => el.classList.remove('number-highlight'));
  if (activeNumber === null) return;
  const targetVal = Number(activeNumber);
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

// Applies the new active CSS class to the keypad
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
        cell.inputMode   = 'none'; /* Default: suppresses native mobile OS virtual keyboard */
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
  moveHistory = [];
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
    if (!btn.dataset.val) return; // Skip non-number buttons like Undo
    
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

  if (activeNumber === null && !selected) {
    selectCell(z, row, col);
  }
}

function onCellPointerDown(e) {
  e.preventDefault(); 
  
  const el = e.currentTarget;
  const z = Number(el.dataset.z);
  const row = Number(el.dataset.row);
  const col = Number(el.dataset.col);
  
  if (clueSet.has(`${z},${row},${col}`)) {
    activeNumber = String(state[z][row][col]);
    updateKeyboardUI();
    updateNumberHighlights();
    clearHighlights();
    applyCrosshair(z, row, col);
    selected = null;
    return;
  }

  if (activeNumber !== null) {
    fillCell(z, row, col, activeNumber);
    
    if (activeNumber === null) {
      return;
    }

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
  if (!valStr) return; // Prevent crashes if utility buttons share this click listener

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

  try {
    const res = await fetch(`/game/new-game?difficulty=${currentDifficulty}`);
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();

    state = emptyGrid();
    clueSet = new Set();

    for (const [z, row, col, value] of data.clues) {
      state[z][row][col] = value;
      clueSet.add(`${z},${row},${col}`);
    }

    renderState();
    updateDepletion(); 
    startTimer();
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
    });
  }

  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      currentTheme = e.target.value;
      document.body.setAttribute('data-theme', currentTheme);
      updateNumberHighlights();
    });
  }
  
  const toggleKey = document.getElementById('toggle-keyboard');
  if (toggleKey) {
    // 1. Sync on load just in case the checkbox starts off
    setTimeout(() => {
      const isChecked = toggleKey.checked;
      document.querySelectorAll('.cell').forEach(cell => {
        cell.inputMode = isChecked ? 'none' : 'numeric';
      });
    }, 50);

    // 2. Sync whenever toggled
    toggleKey.addEventListener('change', (e) => {
      const kb = document.getElementById('onscreen-keyboard');
      if (kb) kb.style.display = e.target.checked ? 'flex' : 'none';
      
      document.querySelectorAll('.cell').forEach(cell => {
        cell.inputMode = e.target.checked ? 'none' : 'numeric';
      });
    });
  }

  const toggleSticky = document.getElementById('toggle-sticky-keys');
  if (toggleSticky) {
    toggleSticky.addEventListener('change', (e) => {
      stickyKeysEnabled = e.target.checked;
    });
  }

  document.querySelectorAll('.key-btn').forEach(btn => {
    btn.addEventListener('click', (e) => handleKeyboardTap(e.target.dataset.val));
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#slices-container') && !e.target.closest('.keyboard-container') && !e.target.closest('.top-action-bar')) {
      clearSelection();
    }
  });

  newGame();
}

document.addEventListener('DOMContentLoaded', init);