modules.define(
    { block : 'intersection' },
    ['game'],
    function(provide, Game) {

provide({
    onSetMod : {
        js : {
            inited : function() {
                this._col = this.params.col;
                this._row = this.params.row;
            }
        }
    },

    getCol : function() {
        return this._col;
    },

    getRow : function() {
        return this._row;
    },

    _onPointerClick : function() {
        this.emit('click');
    }
}, {
    live : function() {
        this.liveBindTo('pointerclick', function() {
            this._onPointerClick();
        });
    },

    build : function(game, row, col) {
        var state = game.getStateByPos(row, col),
            color = state === Game.EMPTY?
                '' :
                (state === Game.BLACK? 'black' : 'white');

        return {
            block : 'intersection',
            mods : { color : color },
            js : {
                col : col,
                row : row
            }
        };
    }
});

});
