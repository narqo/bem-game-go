modules.define('game', ['inherit'], function(provide, inherit) {

var EMPTY = 0,
    BLACK = 1,
    WHITE = 2;

provide(inherit({
    __constructor : function(size) {
        this._lastMovePassed = false;
        this._inAtari = false;
        this._attempedSuicide = false;
        this._gameOver = false;
        this._currentColor = BLACK;
        this._size = size;
        this._board = this._createBoard(size);
    },

    _createBoard : function(size) {
        var board = [];
        for(var col = 0; col < size; col++) {
            board[col] = [];
            for(var row = 0; row < size; row++) {
                board[col][row] = EMPTY;
            }
        }
        return board;
    },

    /**
     * Whether player is in atari state
     * @returns {Boolean}
     */
    isInAtari : function() {
        return this._inAtari;
    },

    /**
     * Whether player attempted to make a suicide turn
     * @returns {Boolean}
     */
    isAttemptedSuicide : function() {
        return this._attempedSuicide;
    },

    /**
     * Whether game is over
     * @returns {Boolean}
     */
    isGameOver : function() {
        return this._gameOver;
    },

    /**
     * Returns size of the game
     * @returns {Number}
     */
    getSize : function() {
        return this._size;
    },

    /**
     * Returns current player color
     * @returns {Number}
     */
    getCurrentColor : function() {
        return this._currentColor;
    },

    /**
     * Returns game state in a given position
     * @param {Number|Array} colOrPos
     * @param {Number} [row]
     * @returns {Number}
     */
    getStateByPos : function(colOrPos, row) {
        var board = this._board;
        return typeof row === 'undefined'?
            board[colOrPos[0]][colOrPos[1]] :
            board[colOrPos][row];
    },

    _switchPlayer : function() {
        this._currentColor = this._currentColor === BLACK? WHITE : BLACK;
    },

    _getAdjacentPoints : function(col, row) {
        var points = [],
            size = this._size;

        col > 0 && points.push([col - 1, row]);
        col < size - 1 && points.push([col + 1, row]);

        row > 0 && points.push([col, row - 1]);
        row < size -1 && points.push([col, row + 1]);

        return points;
    },

    _getGroup : function(col, row) {
        var state = this.getStateByPos(col, row);
        if(state === EMPTY)
            return null;

        var visited = {},
            visitedList = [],
            queue = [[col, row]],
            liberties = 0,
            stone;

        while(stone = queue.pop()) {
            if(visited[stone]) continue;

            this._getAdjacentPoints(stone[0], stone[1]).forEach(function(pos) {
                var stateInPos = this.getStateByPos(pos);
                if(stateInPos === EMPTY) {
                    liberties++;
                    return;
                }

                stateInPos === state && queue.push([pos[0], pos[1]]);
            }, this);

            visited[stone] = true;
            visitedList.push(stone);
        }

        return {
            liberties : liberties,
            stones : visitedList
        };
    },

    /**
     * Pass current's player turn
     * @returns {this}
     */
    pass : function() {
        if(this._lastMovePassed)
            return this.endGame();

        this._lastMovePassed = true;
        this._switchPlayer();

        return this;
    },

    /**
     * Make a turn
     * Returns a flag whether this turn was possible to make
     * @param {Number} col
     * @param {Number} row
     * @returns {Boolean}
     */
    play : function(col, row) {
        if(this._gameOver)
            throw new Error('The game is already over');

        this._attempedSuicide = this._inAtari = false;

        if(this.getStateByPos(col, row) !== EMPTY) {
            console.log('could not play in non empty position ' + col + ', ' + row);
            return false;
        }

        var color = this._board[col][row] = this._currentColor,
            neighbors = this._getAdjacentPoints(col, row),
            captured = [],
            atari = false;

        neighbors.forEach(function(pos) {
            var state = this.getStateByPos(pos);
            if(state === EMPTY || state === color) return;

            var group = this._getGroup(pos[0], pos[1]),
                liberties = group.liberties;

            liberties === 0?
                captured.push(group) :
                liberties === 1 && (atari = true );
        }, this);

        // detect suicide
        if(captured.length === 0 && this._getGroup(col, row).liberties === 0) {
            this._board[col][row] = EMPTY;
            this._attempedSuicide = true;
            return false;
        }

        captured.forEach(function(group) {
            group.stones.forEach(function(stone) {
                this._board[stone[0]][stone[1]] = EMPTY;
            }, this);
        }, this);

        this._inAtari = atari;
        this._lastMovePassed = false;

        this._switchPlayer();

        return true;
    },

    /**
     * End the game
     * @returns {this}
     */
    endGame : function() {
        this._gameOver = true;
        return this;
    }
}, {
    EMPTY : EMPTY,
    BLACK : BLACK,
    WHITE : WHITE
}));

});
