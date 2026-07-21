"""
3D Sudoku (3-SSC) Flask backend.

Grid indexing convention (matches the uploaded solver):
  grid[z][y][x]   — z ∈ {0,1,2}, y = row ∈ {0,1,2}, x = col ∈ {0,1,2}
  Value 0 means empty; values 1-9 are filled.

3-SSC constraints (enforced by is_valid):
  • Every z-slice  (the xy-plane at a fixed z) contains each number exactly once.
  • Every y-slice  (the xz-plane at a fixed y) contains each number exactly once.
  • Every x-slice  (the yz-plane at a fixed x) contains each number exactly once.
"""

import os
import copy
import random
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)


# ---------------------------------------------------------------------------
# 3-SSC core logic (provided)
# ---------------------------------------------------------------------------

def is_valid(grid, x, y, z, num, n=3):
    """Check whether placing num at (x, y, z) violates any 3-SSC constraint."""
    # z-slice: the xy-plane at this z must not already contain num
    for i in range(n):
        for j in range(n):
            if grid[z][i][j] == num:
                return False
    # y-slice: the xz-plane at this y must not already contain num
    for i in range(n):
        for j in range(n):
            if grid[i][y][j] == num:
                return False
    # x-slice: the yz-plane at this x must not already contain num
    for i in range(n):
        for j in range(n):
            if grid[i][j][x] == num:
                return False
    return True


def solve_and_count(grid, n=3, count=None):
    """
    Recursively solve the grid and count valid completions.
    Stops early once count reaches 2 (uniqueness check only needs ≤2).
    """
    if count is None:
        count = [0]
    if count[0] > 1:
        return

    for z in range(n):
        for y in range(n):
            for x in range(n):
                if grid[z][y][x] == 0:
                    for num in range(1, n ** 2 + 1):
                        if is_valid(grid, x, y, z, num, n):
                            grid[z][y][x] = num
                            solve_and_count(grid, n, count)
                            grid[z][y][x] = 0
                    return  # backtrack: only process the first empty cell
    count[0] += 1


def generate_solved_grid(grid, n=3):
    """Fill an empty grid with one fully-solved valid 3-SSC configuration."""
    cells = [(z, y, x) for z in range(n) for y in range(n) for x in range(n)]

    for z, y, x in cells:
        if grid[z][y][x] == 0:
            nums = list(range(1, n ** 2 + 1))
            random.shuffle(nums)
            for num in nums:
                if is_valid(grid, x, y, z, num, n):
                    grid[z][y][x] = num
                    if generate_solved_grid(grid, n):
                        return True
                    grid[z][y][x] = 0
            return False  # no valid number found; backtrack
    return True


def generate_unique_puzzle(n=3):
    """
    Create a 3-SSC puzzle with exactly one valid solution.

    Starting from a fully-solved grid, cells are removed one at a time
    (in random order). A cell is kept as a clue whenever its removal
    would allow more than one solution.

    Returns grid[z][y][x] with 0 for empty cells and 1-9 for clues.
    """
    grid = [[[0] * n for _ in range(n)] for _ in range(n)]
    generate_solved_grid(grid, n)

    cells = [(z, y, x) for z in range(n) for y in range(n) for x in range(n)]
    random.shuffle(cells)

    for z, y, x in cells:
        backup = grid[z][y][x]
        grid[z][y][x] = 0

        grid_copy = copy.deepcopy(grid)
        solutions = [0]
        solve_and_count(grid_copy, n, solutions)

        if solutions[0] != 1:
            grid[z][y][x] = backup  # removal broke uniqueness — keep as clue

    return grid


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def grid_to_response(grid, n=3):
    """
    Convert a raw grid[z][y][x] into the JSON shape the frontend expects:
      {
        "grid":  [[[int, ...], ...], ...],  — grid[z][row][col], 0 = empty
        "clues": [[z, row, col, value], ...]
      }
    row ↔ y, col ↔ x.
    """
    clues = []
    for z in range(n):
        for y in range(n):
            for x in range(n):
                v = grid[z][y][x]
                if v != 0:
                    clues.append([z, y, x, v])
    return {"grid": grid, "clues": clues}


def check_3ssc(grid, n=3):
    """
    Validate a completed grid against all 3-SSC constraints.

    Returns (is_valid: bool, message: str, conflicts: list[[z,y,x]]).
    conflicts lists every cell that participates in a violated constraint.
    """
    expected = set(range(1, n ** 2 + 1))
    conflicts = set()

    # Check z-slices (xy-planes)
    for z in range(n):
        vals = [grid[z][y][x] for y in range(n) for x in range(n)]
        if set(vals) != expected:
            for y in range(n):
                for x in range(n):
                    conflicts.add((z, y, x))

    # Check y-slices (xz-planes)
    for y in range(n):
        vals = [grid[z][y][x] for z in range(n) for x in range(n)]
        if set(vals) != expected:
            for z in range(n):
                for x in range(n):
                    conflicts.add((z, y, x))

    # Check x-slices (yz-planes)
    for x in range(n):
        vals = [grid[z][y][x] for z in range(n) for y in range(n)]
        if set(vals) != expected:
            for z in range(n):
                for y in range(n):
                    conflicts.add((z, y, x))

    if conflicts:
        return False, "Some constraints are violated — highlighted cells conflict.", [list(c) for c in conflicts]
    return True, "Puzzle solved correctly! 🎉", []


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/new-game")
def new_game():
    grid = generate_unique_puzzle()
    return jsonify(grid_to_response(grid))


@app.route("/api/check-solution", methods=["POST"])
def check_solution():
    data = request.get_json(force=True)
    grid = data.get("grid")

    if grid is None:
        return jsonify({"valid": False, "message": "No grid data received."}), 400

    n = 3
    # Ensure every cell is filled with a number 1-9 before checking constraints
    for z in range(n):
        for y in range(n):
            for x in range(n):
                v = grid[z][y][x]
                if not isinstance(v, int) or v < 1 or v > 9:
                    return jsonify({
                        "valid": False,
                        "message": "Some cells are still empty or contain invalid values.",
                        "conflicts": []
                    })

    valid, message, conflicts = check_3ssc(grid, n)
    return jsonify({"valid": valid, "message": message, "conflicts": conflicts})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
