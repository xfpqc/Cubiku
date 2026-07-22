/**
 * 3D Sudoku (3-SSC) — Frontend Logic
 *
 * Cells are <input> elements — tapping one opens the native mobile keyboard.
 * Physical keyboard still works on desktop.
 *
 * Grid state: state[z][row][col]  (indices 0-2, value 0 = empty)
 *
 * Highlight system (crosshair):
 *   .active-cell         — the cell the user just tapped
 *   .constraint-highlight — every other cell that shares the same row OR
 *                           the same column, mirrored across all three slices
 */

// ── State ──────────────────────────────────────────────────────────────────

/** Current cell values: 3×3×3 array, 0 = empty */
let state = emptyGrid();

/** Positions that are fixed clues — Set of "z,row,col" strings */
let clueSet = new Set();

/** Currently selected cell coords, or null */
let selected = null;   // { z, row, col }

// ── DOM helpers ────────────────────────────────────────────────────────────

function emptyGrid() {
  return Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, () => Array(3).fill(0))
  );
}

function cellId(z, row, col) {
  return `cell-${z}-${row}-${col}`;
}

function getCell(z, row, col) {
  return document.getElementById(cellId(z, row, col));
}

function showMessage(text, type = 'info') {
  const bar = document.getElementById('message-bar');
  bar.textContent = text;
  bar.className   = `message-bar ${type}`;
}

function hideMessage() {
  document.getElementById('message-bar').className = 'message-bar hidden';
}

// ── Crosshair highlight ────────────────────────────────────────────────────

/**
 * Clear all crosshair classes from every cell.
 */
function clearHighlights() {
  document.querySelectorAll('.cell.active-cell, .cell.constraint-highlight')
    .forEach(el => el.classList.remove('active-cell', 'constraint-highlight'));
}

/**
 * Apply the crosshair for the cell at (selZ, selRow, selCol).
 *
 * Rules (mirrored across all three z-slices):
 *   - Every cell in row selRow → .constraint-highlight
 *   - Every cell in col selCol → .constraint-highlight
 *   - The tapped cell itself   → .active-cell  (overrides constraint-highlight)
 */
function applyCrosshair(selZ, selRow, selCol) {
  for (let z = 0; z < 3; z++) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (r !== selRow && c !== selCol) continue;   // not on either arm
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

  // Clue cells: cannot be selected, no crosshair
  if (clueSet.has(`${z},${row},${col}`)) {
    selected = null;
    return;
  }

  selected = { z, row, col };
  applyCrosshair(z, row, col);
}

function clearSelection() {
  clearHighlights();
  selected = null;
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
        cell.dataset.x   = col;   // column index (used for crosshair)
        cell.dataset.y   = row;   // row index    (used for crosshair)
        cell.setAttribute('aria-label', `Slice z=${z} row ${row + 1} col ${col + 1}`);
        cell.setAttribute('autocomplete', 'off');
        cell.setAttribute('autocorrect', 'off');
        cell.setAttribute('spellcheck', 'false');

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
        el.classList.remove('conflict', 'active-cell', 'constraint-highlight');
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
  const z   = Number(el.dataset.z);
  const row = Number(el.dataset.row);
  const col = Number(el.dataset.col);

  selectCell(z, row, col);

  // Select all text so the next keystroke replaces the existing digit
  el.select();
}

function onCellInput(e) {
  const el  = e.currentTarget;
  const z   = Number(el.dataset.z);
  const row = Number(el.dataset.row);
  const col = Number(el.dataset.col);

  if (clueSet.has(`${z},${row},${col}`)) return;

  // Keep only the last valid digit (1–9); strip everything else
  const digit = el.value.replace(/[^1-9]/g, '').slice(-1);
  el.value = digit;

  const value = digit ? Number(digit) : 0;
  state[z][row][col] = value;

  el.classList.remove('conflict');
  hideMessage();
}

function onCellKeydown(e) {
  const el  = e.currentTarget;
  const z   = Number(el.dataset.z);
  const row = Number(el.dataset.row);
  const col = Number(el.dataset.col);

  // Backspace / Delete — clear the cell
  if (e.key === 'Backspace' || e.key === 'Delete') {
    if (!clueSet.has(`${z},${row},${col}`)) {
      e.preventDefault();
      el.value = '';
      state[z][row][col] = 0;
      el.classList.remove('conflict');
      hideMessage();
    }
    return;
  }

  // Escape — deselect
  if (e.key === 'Escape') {
    clearSelection();
    el.blur();
    return;
  }

  // Arrow keys — move focus to the adjacent cell within the same slice
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

  const grid = state.map(slice => slice.map(row => [...row]));

  setLoading(true);
  try {
    const res  = await fetch('/game/check-solution', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ grid }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();

    if (data.valid) {
      showMessage(data.message, 'success');
      clearSelection();
    } else {
      showMessage(data.message, 'error');

      if (Array.isArray(data.conflicts)) {
        for (const [z, row, col] of data.conflicts) {
          getCell(z, row, col)?.classList.add('conflict');
        }
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

  newGame();
}

document.addEventListener('DOMContentLoaded', init);
