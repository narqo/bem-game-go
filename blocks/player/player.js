modules.define('player', ['i-bem__dom', 'game'], function(provide, BEMDOM, Game) {

provide(BEMDOM.decl(this.name, {
    onSetMod : {
        'js' : {
            'inited' : function() {
                this._val = this.params.val;
            }
        }
    },

    getVal : function() {
        return this._val;
    },

    setVal : function(val) {
        if(val !== this._val) {
            this.elem('score').text(this._val = val);
            this.emit('change');
        }
        return this;
    }
}, {
    live : true,

    build : function(game, color) {
        var val = game.getScore(color),
            isBlack = color === Game.BLACK;
        return {
            block : this.getName(),
            mods : { color : isBlack? 'black' : 'white' },
            js : { val : val },
            content : [
                isBlack? 'BLACK' : 'WHITE',
                { elem : 'score', content : val }
            ]
        };
    }
}));

});
