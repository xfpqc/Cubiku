/**
 * Cubiku — 3D Sudoku frontend
 *
 * Cells are <input> elements so the native mobile keyboard appears on tap.
 * Physical keyboard works on desktop.
 *
 * Grid state: state[z][row][col]  (indices 0-2, value 0 = empty)
 *
 * Highlight classes:
 *   .active-cell          — the cell currently tapped (cyan circle)
 *   .constraint-highlight — entire row + col across all 3 slices (ghost tint)
 *   .flash-conflict       — 1-second red flash on cells that clash with a new entry
 */

// ── State ──────────────────────────────────────────────────────────────────

let state    = emptyGrid();   // 3×3×3 array, 0 = empty
let clueSet  = new Set();     // "z,row,col" strings for fixed clues
let selected = null;          // { z, row, col } | null

// ── Move history (undo stack) ──────────────────────────────────────────────

// Each entry: { z, row, col, before, after }
let moveHistory = [];

function pushHistory(z, row, col, before, after) {
  if (before === after) return;   // no real change; skip
  moveHistory.push({ z, row, col, before, after });
  updateUndoButton();
}

function updateUndoButton() {
  document.getElementById('btn-undo').disabled = moveHistory.length === 0;
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

  updateUndoButton();
  hideMessage();
}

// ── Timer ──────────────────────────────────────────────────────────────────

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
  const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const s = String(timerSeconds % 60).padStart(2, '0');
  document.getElementById('timer-display').textContent = `${m}:${s}`;
}

// ── Zen Mode ───────────────────────────────────────────────────────────────

let zenMode = false;

function toggleZen() {
  zenMode = !zenMode;
  document.getElementById('timer-bar').classList.toggle('zen', zenMode);
  document.getElementById('icon-eye-open').style.display  = zenMode ? 'none'  : '';
  document.getElementById('icon-eye-closed').style.display = zenMode ? ''     : 'none';
  document.getElementById('btn-zen').title =
    zenMode ? 'Zen Mode — show timer' : 'Zen Mode — hide timer';
}

// ── DOM helpers ────────────────────────────────────────────────────────────

function emptyGrid() {
  return Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, () => Array(3).fill(0))
  );
}

function cellId(z, row, col) { return `cell-${z}-${row}-${col}`; }
function getCell(z, row, col) { return document.getElementById(cellId(z, row, col)); }

function showMessage(text, type = 'info') {
  const bar = document.getElementById('message-bar');
  bar.textContent = text;
  bar.className   = `message-bar ${type}`;
}

function hideMessage() {
  document.getElementById('message-bar').className = 'message-bar hidden';
}

// ── Crosshair highlight ────────────────────────────────────────────────────

function clearHighlights() {
  document.querySelectorAll('.cell.active-cell, .cell.constraint-highlight')
    .forEach(el => el.classList.remove('active-cell', 'constraint-highlight'));
}

/**
 * Highlight the full row and full column of the tapped cell, mirrored
 * across all three z-slices. The tapped cell itself gets .active-cell;
 * every other cell on either arm gets .constraint-highlight.
 */
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

// ── Selection ──────────────────────────────────────────────────────────────

function selectCell(z, row, col) {
  clearHighlights();
  // Clues show the crosshair but cannot be edited — selected stays null for them
  selected = clueSet.has(`${z},${row},${col}`) ? null : { z, row, col };
  applyCrosshair(z, row, col);
}

function clearSelection() {
  clearHighlights();
  selected = null;
}

// ── Conflict flash ─────────────────────────────────────────────────────────

/**
 * After placing `value` at (z, row, col), check whether it clashes with
 * any existing cell in the same row (within the slice), same column
 * (within the slice), or the same depth pillar (same row+col, all z).
 * Clashing cells briefly flash red for 1 second.
 */
function flashConflicts(z, row, col, value) {
  if (!value) return;

  const clashEls = [];

  // Same row, same slice
  for (let c = 0; c < 3; c++) {
    if (c !== col && state[z][row][c] === value) {
      const el = getCell(z, row, c);
      if (el) clashEls.push(el);
    }
  }

  // Same column, same slice
  for (let r = 0; r < 3; r++) {
    if (r !== row && state[z][r][col] === value) {
      const el = getCell(z, r, col);
      if (el) clashEls.push(el);
    }
  }

  // Depth pillar — same (row, col) in the other two slices
  for (let oz = 0; oz < 3; oz++) {
    if (oz !== z && state[oz][row][col] === value) {
      const el = getCell(oz, row, col);
      if (el) clashEls.push(el);
    }
  }

  if (clashEls.length === 0) return;

  clashEls.forEach(el => {
    el.classList.remove('flash-conflict');         // reset if already flashing
    // Force a reflow so the class removal registers before re-adding
    void el.offsetWidth;
    el.classList.add('flash-conflict');
    setTimeout(() => el.classList.remove('flash-conflict'), 1000);
  });
}

// ── Grid rendering ─────────────────────────────────────────────────────────

function buildGrids() {
  for (let z = 0; z < 3; z++) {
    const container = document.getElementById(`grid-z${z}`);
    container.innerHTML = '';

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const cell = document.createElement('input');
        cell.type        = 'text';
        cell.inputMode   = 'numeric';
        cell.maxLength   = 1;
        cell.id          = cellId(z, row, col);
        cell.className   = 'cell';
        cell.dataset.z   = z;
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.dataset.x   = col;
        cell.dataset.y   = row;
        cell.setAttribute('aria-label', `Slice z=${z} row ${row + 1} col ${col + 1}`);
        cell.setAttribute('autocomplete', 'off');
        cell.setAttribute('autocorrect',  'off');
        cell.setAttribute('spellcheck',   'false');

        cell.addEventListener('focus',   onCellFocus);
        cell.addEventListener('input',   onCellInput);
        cell.addEventListener('keydown', onCellKeydown);

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
}

function setLoading(on) {
  document.querySelectorAll('.grid').forEach(g => g.classList.toggle('loading', on));
  document.getElementById('btn-new-game').disabled = on;
  document.getElementById('btn-check').disabled    = on;
}

// ── Cell event handlers ────────────────────────────────────────────────────

function onCellFocus(e) {
  const el  = e.currentTarget;
  selectCell(Number(el.dataset.z), Number(el.dataset.row), Number(el.dataset.col));
  el.select();
}

function onCellInput(e) {
  const el  = e.currentTarget;
  const z   = Number(el.dataset.z);
  const row = Number(el.dataset.row);
  const col = Number(el.dataset.col);

  if (clueSet.has(`${z},${row},${col}`)) return;

  const digit  = el.value.replace(/[^1-9]/g, '').slice(-1);
  el.value     = digit;

  const before = state[z][row][col];
  const after  = digit ? Number(digit) : 0;

  state[z][row][col] = after;
  pushHistory(z, row, col, before, after);

  el.classList.remove('conflict', 'flash-conflict');
  hideMessage();

  // Immediately check for visible clashes and flash them
  flashConflicts(z, row, col, after);
}

function onCellKeydown(e) {
  const el  = e.currentTarget;
  const z   = Number(el.dataset.z);
  const row = Number(el.dataset.row);
  const col = Number(el.dataset.col);

  // Backspace / Delete
  if (e.key === 'Backspace' || e.key === 'Delete') {
    if (!clueSet.has(`${z},${row},${col}`)) {
      e.preventDefault();
      const before = state[z][row][col];
      el.value = '';
      state[z][row][col] = 0;
      pushHistory(z, row, col, before, 0);
      el.classList.remove('conflict', 'flash-conflict');
      hideMessage();
    }
    return;
  }

  // Escape
  if (e.key === 'Escape') { clearSelection(); el.blur(); return; }

  // Arrow keys — move within the same slice
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
  }
}

// ── New Game ───────────────────────────────────────────────────────────────

async function newGame() {
  setLoading(true);
  hideMessage();
  stopTimer();

  try {
    const res  = await fetch('/game/new-game');
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();

    state   = emptyGrid();
    clueSet = new Set();

    for (const [z, row, col, value] of data.clues) {
      state[z][row][col] = value;
      clueSet.add(`${z},${row},${col}`);
    }

    renderState();
    startTimer();
    showMessage('New puzzle loaded. Good luck!', 'info');
  } catch (err) {
    showMessage(`Failed to load puzzle: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

// ── Check Solution ─────────────────────────────────────────────────────────

async function checkSolution() {
  hideMessage();
  document.querySelectorAll('.cell.conflict').forEach(c => c.classList.remove('conflict'));

  setLoading(true);
  try {
    const res  = await fetch('/game/check-solution', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ grid: state.map(sl => sl.map(r => [...r])) }),
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

// ── Initialise ─────────────────────────────────────────────────────────────

function init() {
  buildGrids();
  renderState();

  document.getElementById('btn-new-game').addEventListener('click', newGame);
  document.getElementById('btn-check').addEventListener('click', checkSolution);
  document.getElementById('btn-undo').addEventListener('click', undoMove);
  document.getElementById('btn-zen').addEventListener('click', toggleZen);

  // Tap / click anywhere outside the grids → clear crosshair
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#slices-container')) {
      clearSelection();
    }
  });

  newGame();
}

document.addEventListener('DOMContentLoaded', init);
