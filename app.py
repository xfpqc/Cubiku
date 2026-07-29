"""
3D Sudoku (3-SSC) Flask backend.
"""

import os
import copy
import random
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

def is_valid(grid, x, y, z, num, n=3):
    for i in range(n):
        for j in range(n):
            if grid[z][i][j] == num:
                return False
    for i in range(n):
        for j in range(n):
            if grid[i][y][j] == num:
                return False
    for i in range(n):
        for j in range(n):
            if grid[i][j][x] == num:
                return False
    return True

def solve_and_count(grid, n=3, count=None):
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
                    return  
    count[0] += 1

def generate_solved_grid(grid, n=3):
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
            return False  
    return True

def generate_unique_puzzle(n=3, difficulty='medium'):
    """
    Create a 3-SSC puzzle with exactly one valid solution.
    Optimized with difficulty-guided early stopping to dramatically speed up generation.
    """
    grid = [[[0] * n for _ in range(n)] for _ in range(n)]
    generate_solved_grid(grid, n)

    cells = [(z, y, x) for z in range(n) for y in range(n) for x in range(n)]
    random.shuffle(cells)

    target_min_clues = 12 if difficulty == 'easy' else (10 if difficulty == 'medium' else 8)
    current_clues = n ** 3

    for z, y, x in cells:
        if current_clues <= target_min_clues and difficulty != 'hard':
            break

        backup = grid[z][y][x]
        grid[z][y][x] = 0

        grid_copy = copy.deepcopy(grid)
        solutions = [0]
        solve_and_count(grid_copy, n, solutions)

        if solutions[0] != 1:
            grid[z][y][x] = backup  
        else:
            current_clues -= 1

    return grid

def measure_human_difficulty(grid, n=3):
    """
    Calibrated heuristic evaluator:
    - Simulates basic 'Naked Single' logic.
    - Easy: Solved completely or nearly completely by naked singles with higher clue density.
    - Medium: Stalls moderately, leaving a few unresolved cells.
    - Hard: Naked singles stall significantly (leaving multiple cells unresolved) OR absolute minimum clue density (8-10 clues).
    """
    test_grid = copy.deepcopy(grid)
    progress = True
    total_cells = n ** 3
    initial_empty = sum(1 for z in range(n) for y in range(n) for x in range(n) if test_grid[z][y][x] == 0)
    empty_count = initial_empty

    while progress and empty_count > 0:
        progress = False
        for z in range(n):
            for y in range(n):
                for x in range(n):
                    if test_grid[z][y][x] == 0:
                        valid_moves = [num for num in range(1, n**2 + 1) if is_valid(test_grid, x, y, z, num, n)]
                        if len(valid_moves) == 1:
                            test_grid[z][y][x] = valid_moves[0]
                            empty_count -= 1
                            progress = True

    clues_count = total_cells - initial_empty

    # Strict separation based on clue density and logical stalling
    if clues_count >= 11 and empty_count == 0:
        return "easy"
    elif clues_count >= 9 and empty_count <= 3:
        return "medium"
    else:
        return "hard"

def grid_to_response(grid, n=3):
    clues = []
    for z in range(n):
        for y in range(n):
            for x in range(n):
                v = grid[z][y][x]
                if v != 0:
                    clues.append([z, y, x, v])
    return {"grid": grid, "clues": clues}

def check_3ssc(grid, n=3):
    conflicts = set()

    for z in range(n):
        seen = {}
        for y in range(n):
            for x in range(n):
                num = grid[z][y][x]
                if num not in seen:
                    seen[num] = []
                seen[num].append((y, x))
        for num, coords in seen.items():
            if len(coords) > 1:
                for y, x in coords:
                    conflicts.add((z, y, x))

    for y in range(n):
        seen = {}
        for z in range(n):
            for x in range(n):
                num = grid[z][y][x]
                if num not in seen:
                    seen[num] = []
                seen[num].append((z, x))
        for num, coords in seen.items():
            if len(coords) > 1:
                for z, x in coords:
                    conflicts.add((z, y, x))

    for x in range(n):
        seen = {}
        for z in range(n):
            for y in range(n):
                num = grid[z][y][x]
                if num not in seen:
                    seen[num] = []
                seen[num].append((z, y))
        for num, coords in seen.items():
            if len(coords) > 1:
                for z, y in coords:
                    conflicts.add((z, y, x))

    if conflicts:
        return False, "Some constraints are violated — conflicting cells highlighted.", [list(c) for c in conflicts]
    return True, "Puzzle solved correctly! 🎉", []

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/game/new-game")
def new_game():
    requested_difficulty = request.args.get('difficulty', 'medium')
    
    # Pass requested difficulty into generator for optimized target-clue cutoff
    while True:
        grid = generate_unique_puzzle(n=3, difficulty=requested_difficulty)
        actual_difficulty = measure_human_difficulty(grid)
        
        if actual_difficulty == requested_difficulty:
            return jsonify(grid_to_response(grid))

@app.route("/game/check-solution", methods=["POST"])
def check_solution():
    data = request.get_json(force=True)
    grid = data.get("grid")

    if grid is None:
        return jsonify({"valid": False, "message": "No grid data received."}), 400

    n = 3
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

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)