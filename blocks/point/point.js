modules.define('point', ['i-bem__dom', 'game'], function(provide, BEMDOM, Game) {

/** {Number} css size of the point */
var POINT_SIZE = 40;

provide(BEMDOM.decl(this.name, {
    getCol : function() {
        return this.params.col;
    },

    getRow : function() {
        return this.params.row;
    },

    getState : function() {
        return this.getMod('color');
    },

    setState : function(state) {
        state === Game.EMPTY?
            this.delMod('color') :
            this.setMod('color', state === Game.BLACK? 'black' : 'white');
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

        state === Game.EMPTY ||
            (mods.color = state === Game.BLACK? 'black' : 'white');

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
