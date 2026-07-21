/**
 * 3D Sudoku (3-SSC) — Frontend Logic
 *
 * Grid state: state[z][row][col]  (all indices 0-2)
 * Value 0 means empty.
 */

// ── State ──────────────────────────────────────────────────────────────────

/** Current cell values: 3×3×3 array, 0 = empty */
let state  = emptyGrid();

/** Positions that are fixed clues; Set of "z,row,col" strings */
let clueSet = new Set();

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
  bar.textContent  = text;
  bar.className    = `message-bar ${type}`;
}

function hideMessage() {
  document.getElementById('message-bar').className = 'message-bar hidden';
}

// ── Grid rendering ─────────────────────────────────────────────────────────

function buildGrids() {
  for (let z = 0; z < 3; z++) {
    const container = document.getElementById(`grid-z${z}`);
    container.innerHTML = '';

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const input = document.createElement('input');
        input.type        = 'text';
        input.inputMode   = 'numeric';
        input.maxLength   = 1;
        input.id          = cellId(z, row, col);
        input.className   = 'cell';
        input.dataset.z   = z;
        input.dataset.row = row;
        input.dataset.col = col;
        input.setAttribute('aria-label', `Slice z=${z} row ${row + 1} col ${col + 1}`);

        input.addEventListener('keydown', onCellKeydown);
        input.addEventListener('input',   onCellInput);

        container.appendChild(input);
      }
    }
  }
}

function renderState() {
  for (let z = 0; z < 3; z++) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const input  = getCell(z, row, col);
        const isClue = clueSet.has(`${z},${row},${col}`);
        const val    = state[z][row][col];

        input.value       = val > 0 ? String(val) : '';
        input.readOnly    = isClue;
        input.disabled    = false;
        input.classList.toggle('clue', isClue);
        input.classList.remove('conflict');
      }
    }
  }
}

function setLoading(on) {
  document.querySelectorAll('.grid').forEach(g => g.classList.toggle('loading', on));
  document.getElementById('btn-new-game').disabled = on;
  document.getElementById('btn-check').disabled    = on;
}

// ── Input handling ─────────────────────────────────────────────────────────

function onCellKeydown(e) {
  const allowed = new Set([
    'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  ]);
  // Allow 1-9
  if (/^[1-9]$/.test(e.key)) return;
  // Allow control keys
  if (allowed.has(e.key) || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
}

function onCellInput(e) {
  const input = e.target;
  const z     = Number(input.dataset.z);
  const row   = Number(input.dataset.row);
  const col   = Number(input.dataset.col);

  // Keep only the last valid character
  const cleaned = input.value.replace(/[^1-9]/g, '').slice(-1);
  input.value   = cleaned;

  state[z][row][col] = cleaned ? Number(cleaned) : 0;
  input.classList.remove('conflict');
  hideMessage();
}

// ── Navigation between cells with arrow keys ───────────────────────────────

document.addEventListener('keydown', e => {
  const active = document.activeElement;
  if (!active || !active.classList.contains('cell')) return;

  const z   = Number(active.dataset.z);
  const row = Number(active.dataset.row);
  const col = Number(active.dataset.col);

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
});

// ── New Game ───────────────────────────────────────────────────────────────

async function newGame() {
  setLoading(true);
  hideMessage();

  try {
    const res  = await fetch('/api/new-game');
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();

    // Reset local state
    state   = emptyGrid();
    clueSet = new Set();

    // Apply clues: each entry is [z, row, col, value]
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

  // Clear previous conflict highlights
  document.querySelectorAll('.cell.conflict').forEach(c => c.classList.remove('conflict'));

  // Build the grid to send (0 for empty)
  const grid = state.map(slice => slice.map(row => [...row]));

  setLoading(true);
  try {
    const res  = await fetch('/api/check-solution', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ grid }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();

    if (data.valid) {
      showMessage(data.message, 'success');
    } else {
      showMessage(data.message, 'error');

      // Highlight any cells flagged as conflicting by the server
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

  // Load a puzzle automatically on first visit
  newGame();
}

document.addEventListener('DOMContentLoaded', init);
