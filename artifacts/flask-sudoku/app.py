"""
3D Sudoku (3-SSC) Flask backend.

Structure of the 3D grid:
  grid[z][row][col]  — z ∈ {0,1,2}, row ∈ {0,1,2}, col ∈ {0,1,2}
  Value 0 means empty; values 1-9 are filled.

NOTE: Replace the placeholder functions below with your 3-SSC-specific
      puzzle generation and validation logic in the next step.
"""

import os
import random
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)


# ---------------------------------------------------------------------------
# PLACEHOLDER — replace with real 3-SSC generation logic
# ---------------------------------------------------------------------------

def generate_puzzle():
    """
    Generate a 3-SSC puzzle.

    Returns a dict:
      {
        "grid":  [[[int, int, int], ...], ...],   # [z][row][col], 0 = empty
        "clues": [[z, row, col, value], ...]       # pre-filled positions
      }

    Replace this function body with your unique 3-SSC constraint solver.
    """
    # Hard-coded sample puzzle so the UI works before real logic is wired in.
    # Each entry is (z, row, col, value).
    fixed = [
        (0, 0, 0, 1), (0, 0, 1, 5), (0, 0, 2, 9),
        (0, 1, 0, 4), (0, 2, 2, 7),
        (1, 0, 0, 2), (1, 1, 1, 6), (1, 1, 2, 3),
        (1, 2, 0, 8),
        (2, 0, 2, 4), (2, 1, 0, 7), (2, 2, 1, 2),
        (2, 2, 2, 5),
    ]

    grid = [[[0] * 3 for _ in range(3)] for _ in range(3)]
    clues = []
    for z, r, c, v in fixed:
        grid[z][r][c] = v
        clues.append([z, r, c, v])

    return {"grid": grid, "clues": clues}


def validate_solution(grid):
    """
    Validate a completed 3-SSC grid.

    Returns (is_valid: bool, message: str).

    Replace this function body with your 3-SSC constraint checker.
    """
    # Placeholder: ensure every cell is filled with a number 1-9.
    for z in range(3):
        for r in range(3):
            for c in range(3):
                v = grid[z][r][c]
                if not isinstance(v, int) or v < 1 or v > 9:
                    return False, "Some cells are empty or contain invalid values."

    # -----------------------------------------------------------------------
    # TODO: insert your real 3-SSC constraint checks here
    # -----------------------------------------------------------------------

    return True, "Puzzle solved correctly! 🎉"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/new-game")
def new_game():
    puzzle = generate_puzzle()
    return jsonify(puzzle)


@app.route("/api/check-solution", methods=["POST"])
def check_solution():
    data = request.get_json(force=True)
    grid = data.get("grid")

    if grid is None:
        return jsonify({"valid": False, "message": "No grid data received."}), 400

    valid, message = validate_solution(grid)
    return jsonify({"valid": valid, "message": message})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=True)
