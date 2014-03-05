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
        for(var i = 0; i < size; i++) {
            board[i] = [];
            for(var j = 0; j < size; j++) {
                board[i][j] = EMPTY;
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

    isOver : function() {
        return this._gameOver;
    },

    getSize : function() {
        return this._size;
    },

    getCurrentColor : function() {
        return this._currentColor;
    },

    getStateByPos : function(i, j) {
        var board = this._board;
        return typeof j === 'undefined'?
            board[i[0]][i[1]] :
            board[i][j];
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

    play : function(i, j) {
        if(this._gameOver)
            throw new Error('The game is over already');

        this._attempedSuicide = this._inAtari = false;

        if(this.getStateByPos(i, j) !== EMPTY) {
            console.log('could not play in non empty position ' + i + ', ' + j);
            return false;
        }

        var color = this._board[i][j] = this._currentColor,
            captured = [],
            neighbors = this._getAdjacentIntersections(i, j),
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
        if(captured.length === 0 && this._getGroup(i, j).liberties === 0) {
            this._board[i][j] = EMPTY;
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
