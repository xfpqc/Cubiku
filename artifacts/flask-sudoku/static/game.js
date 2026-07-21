/**
 * 3D Sudoku (3-SSC) — Frontend Logic
 *
 * Cells are <div> elements — no native keyboard is ever triggered.
 * A custom keypad handles all input; physical keys still work on desktop.
 *
 * Grid state: state[z][row][col]  (indices 0-2, value 0 = empty)
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

// ── Selection ──────────────────────────────────────────────────────────────

function selectCell(z, row, col) {
  // Deselect previous
  if (selected) {
    const prev = getCell(selected.z, selected.row, selected.col);
    prev?.classList.remove('selected');
  }

  // Clue cells cannot be selected
  if (clueSet.has(`${z},${row},${col}`)) {
    selected = null;
    return;
  }

  selected = { z, row, col };
  const el = getCell(z, row, col);
  el?.classList.add('selected');
  el?.focus();

  // Light up the depth pillar — same (x, y) in the other two slices
  applyDepthHighlight(row, col);
}

function clearSelection() {
  if (selected) {
    getCell(selected.z, selected.row, selected.col)?.classList.remove('selected');
  }
  document.querySelectorAll('.cell.depth-highlight')
    .forEach(el => el.classList.remove('depth-highlight'));
  selected = null;
}

// ── Depth highlight — same (x, y) pillar across all three slices ───────────

function applyDepthHighlight(row, col) {
  // Clear any existing highlights first
  document.querySelectorAll('.cell.depth-highlight')
    .forEach(el => el.classList.remove('depth-highlight'));

  // Mark the same (row, col) position in every z-slice except the selected one
  for (let z = 0; z < 3; z++) {
    const el = getCell(z, row, col);
    if (el && !el.classList.contains('selected')) {
      el.classList.add('depth-highlight');
    }
  }
}

// ── Keypad input ───────────────────────────────────────────────────────────

function applyValue(value) {
  // value: 1-9 to set, 0 to clear
  if (!selected) return;

  const { z, row, col } = selected;
  if (clueSet.has(`${z},${row},${col}`)) return;

  state[z][row][col] = value;

  const el = getCell(z, row, col);
  if (el) {
    el.textContent = value > 0 ? String(value) : '';
    el.classList.remove('conflict');
  }

  hideMessage();
}

// ── Grid rendering ─────────────────────────────────────────────────────────

function buildGrids() {
  for (let z = 0; z < 3; z++) {
    const container = document.getElementById(`grid-z${z}`);
    container.innerHTML = '';

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const cell = document.createElement('div');
        cell.id          = cellId(z, row, col);
        cell.className   = 'cell';
        cell.tabIndex    = 0;
        cell.role        = 'gridcell';
        cell.dataset.z   = z;
        cell.dataset.row = row;
        cell.dataset.col = col;
        // x = column index, y = row index — used by depth-highlight logic
        cell.dataset.x   = col;
        cell.dataset.y   = row;
        cell.setAttribute('aria-label', `Slice z=${z} row ${row + 1} col ${col + 1}`);

        cell.addEventListener('click',   onCellClick);
        cell.addEventListener('keydown', onCellKeydown);

        container.appendChild(cell);
      }
    }
  }
}

function renderState() {
  // Clear any lingering selection when state is fully reset
  clearSelection();

  for (let z = 0; z < 3; z++) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const el     = getCell(z, row, col);
        const isClue = clueSet.has(`${z},${row},${col}`);
        const val    = state[z][row][col];

        el.textContent = val > 0 ? String(val) : '';
        el.classList.toggle('clue', isClue);
        el.classList.remove('conflict', 'selected');

        // Clues are not focusable or tappable
        el.tabIndex = isClue ? -1 : 0;
      }
    }
  }
}

function setLoading(on) {
  document.querySelectorAll('.grid').forEach(g => g.classList.toggle('loading', on));
  document.getElementById('btn-new-game').disabled = on;
  document.getElementById('btn-check').disabled    = on;
  document.querySelectorAll('.key-btn').forEach(b => b.disabled = on);
}

// ── Cell event handlers ────────────────────────────────────────────────────

function onCellClick(e) {
  const el  = e.currentTarget;
  const z   = Number(el.dataset.z);
  const row = Number(el.dataset.row);
  const col = Number(el.dataset.col);

  // Toggle: tap the already-selected cell to deselect
  if (selected && selected.z === z && selected.row === row && selected.col === col) {
    clearSelection();
  } else {
    selectCell(z, row, col);
  }
}

function onCellKeydown(e) {
  const el  = e.currentTarget;
  const z   = Number(el.dataset.z);
  const row = Number(el.dataset.row);
  const col = Number(el.dataset.col);

  // Enter / Space — select the focused cell
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    selectCell(z, row, col);
    return;
  }

  // Arrow keys — move focus between cells
  const moves = {
    ArrowRight: [z, row, (col + 1) % 3],
    ArrowLeft:  [z, row, (col + 2) % 3],
    ArrowDown:  [z, (row + 1) % 3, col],
    ArrowUp:    [z, (row + 2) % 3, col],
  };

  if (moves[e.key]) {
    e.preventDefault();
    const [nz, nr, nc] = moves[e.key];
    const nextEl = getCell(nz, nr, nc);
    nextEl?.focus();
    // Keep current selection active; only focusing changes
    return;
  }

  // 1-9 — type directly into the selected cell (desktop convenience)
  if (/^[1-9]$/.test(e.key)) {
    selectCell(z, row, col);
    applyValue(Number(e.key));
    return;
  }

  // Backspace / Delete — clear the focused cell
  if (e.key === 'Backspace' || e.key === 'Delete') {
    selectCell(z, row, col);
    applyValue(0);
  }
}

// ── Keypad ─────────────────────────────────────────────────────────────────

function initKeypad() {
  document.querySelectorAll('.key-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyValue(Number(btn.dataset.value));
    });
  });
}

// ── Global physical keyboard (works anywhere on the page) ──────────────────

document.addEventListener('keydown', e => {
  if (!selected) return;

  if (/^[1-9]$/.test(e.key)) {
    applyValue(Number(e.key));
    return;
  }

  if (e.key === 'Backspace' || e.key === 'Delete') {
    applyValue(0);
    return;
  }

  if (e.key === 'Escape') {
    clearSelection();
    return;
  }

  // Arrow keys navigate while keeping selection
  const { z, row, col } = selected;
  const moves = {
    ArrowRight: [z, row, (col + 1) % 3],
    ArrowLeft:  [z, row, (col + 2) % 3],
    ArrowDown:  [z, (row + 1) % 3, col],
    ArrowUp:    [z, (row + 2) % 3, col],
  };

  if (moves[e.key]) {
    e.preventDefault();
    const [nz, nr, nc] = moves[e.key];
    selectCell(nz, nr, nc);
  }
});

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
  initKeypad();

  document.getElementById('btn-new-game').addEventListener('click', newGame);
  document.getElementById('btn-check').addEventListener('click', checkSolution);

  newGame();
}

document.addEventListener('DOMContentLoaded', init);
