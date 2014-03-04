modules.define('point', ['i-bem__dom', 'game'], function(provide, BEMDOM, Game) {

/** {Number} css size of the point */
var POINT_SIZE = 30;

provide(BEMDOM.decl(this.name, {
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
    POINT_SIZE : POINT_SIZE,

    live : function() {
        this.liveBindTo('pointerclick', function() {
            this._onPointerClick();
        });
    },

    build : function(game, row, col) {
        var state = game.getStateByPos(row, col),
            mods = {};

        state === Game.EMPTY || (mods.color = state === Game.BLACK? 'black' : 'white');

        return {
            block : this.getName(),
            mods : mods,
            js : {
                col : col,
                row : row
            }
        };
    }
}));

});
