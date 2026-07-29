from flask import Flask, render_template, jsonify
# import random  (You will need your math/logic libraries here)

# Initialize the Flask application
app = Flask(__name__)

@app.route('/')
def home():
    """
    Serves the main Cubiku visual interface.
    Ensure your frontend HTML file is named 'index.html' and 
    placed inside a folder named 'templates' in your root directory.
    """
    return render_template('index.html')

@app.route('/api/generate')
def generate_puzzle():
    """
    API endpoint that generates the 3D Sudoku board.
    When your frontend requests a new game, this route handles 
    the combinatorial logic and returns the starting clues.
    """
    
    # ---------------------------------------------------------
    # The 3D grid generation logic goes here.
    # This is where we carve the board down to those 8, 9, or 10 
    # clue sweet spots before checking for unique solutions.
    # ---------------------------------------------------------
    
    # Example JSON structure to send back to the web browser
    puzzle_data = {
        "status": "success",
        "starting_clues": 9, 
        "board_state": [] # The nested 3D array data will be passed here
    }
    
    return jsonify(puzzle_data)

if __name__ == "__main__":
    # This is the crucial command that was missing. 
    # It tells the script to actually spin up the local web server.
    app.run(debug=True, port=5000)