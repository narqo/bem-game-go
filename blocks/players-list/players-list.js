modules.define('players-list', ['i-bem__dom', 'game'], function(provide, BEMDOM, Game) {

provide(BEMDOM.decl(this.name, {
    beforeElemSetMod : {
        'player' : {
            'current' : {
                'true' : function(elem, modName) {
                    this.delMod(this.elem('player'), modName);
                }
            }
        }
    },

    updateInformer : function(game) {
        return this.setMod(
            this.elem('player', 'color', game.getCurrentColor() === Game.BLACK? 'black' : 'white'),
            'current');
    }
}, {
    live : true,

    build : function(game) {
        return {
            block : this.getName(),
            content : [
                {
                    elem : 'player',
                    mods : { color : 'black', current : true },
                    content : 'BLACK'
                },
                {
                    elem : 'player',
                    mods : { color : 'white' },
                    content : 'WHITE'
                }
            ]
        };
    }
}));

});
