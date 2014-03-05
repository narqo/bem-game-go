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

    isInAtari : function() {
        return this._inAtari;
    },

    isAttemptedSuicide : function() {
        return this._attempedSuicide;
    },

    isGameOver : function() {
        return this._gameOver;
    },

    getSize : function() {
        return this._size;
    },

    getCurrentColor : function() {
        return this._currentColor;
    },

    getStateByPos : function(colOrPos, row) {
        var board = this._board;
        return typeof row === 'undefined'?
            board[colOrPos[0]][colOrPos[1]] :
            board[colOrPos][row];
    },

    _switchPlayer : function() {
        this._currentColor = this._currentColor === BLACK? WHITE : BLACK;
    },

    _getAdjacentIntersections : function(i, j) {
        var neighbors = [],
            size = this._size;

        i > 0 && neighbors.push([i - 1, j]);
        i < size - 1 && neighbors.push([i + 1, j]);

        j > 0 && neighbors.push([i, j - 1]);
        j < size -1 && neighbors.push([i, j + 1]);

        return neighbors;
    },

    _getGroup : function(i, j) {
        var color = this.getStateByPos(i, j);
        if(color === EMPTY)
            return null;

        var visited = {},
            visitedList = [],
            queue = [[i, j]],
            liberties = 0,
            stone;

        while(stone = queue.pop()) {
            if(visited[stone]) continue;

            this._getAdjacentIntersections(stone[0], stone[1]).forEach(function(n) {
                var state = this.getStateByPos(n);
                if(state === EMPTY) {
                    liberties++;
                    return;
                }

                state === color && queue.push([n[0], n[1]]);
            }, this);

            visited[stone] = true;
            visitedList.push(stone);
        }

        return {
            liberties : liberties,
            stones : visitedList
        };
    },

    pass : function() {
        if(this._lastMovePassed) {
            this.endGame();
            return;
        }

        this._lastMovePassed = true;
        this._switchPlayer();
    },

    play : function(col, row) {
        if(this._gameOver)
            throw new Error('The game is over already');

        this._attempedSuicide = this._inAtari = false;

        if(this.getStateByPos(col, row) !== EMPTY) {
            console.log('could not play in non empty position ' + col + ', ' + row);
            return false;
        }

        var color = this._board[col][row] = this._currentColor,
            captured = [],
            neighbors = this._getAdjacentIntersections(col, row),
            atari = false;

        neighbors.forEach(function(n) {
            var state = this.getStateByPos(n);
            if(state !== EMPTY && state !== color) {
                var group = this._getGroup(n[0], n[1]),
                    liberties = group.liberties;

                if(liberties === 0) {
                    captured.push(group);
                }
                else if(liberties === 1) {
                    atari = true;
                }
            }
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

    endGame : function() {
        this._gameOver = true;
    }
}, {
    EMPTY : EMPTY,
    BLACK : BLACK,
    WHITE : WHITE
}));

});
