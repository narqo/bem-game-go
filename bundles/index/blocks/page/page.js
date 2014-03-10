modules.define('page', ['i-bem__dom'], function(provide, BEMDOM) {

var GAME_SIZE = 11;

provide(BEMDOM.decl(this.name, {
    onSetMod : {
        'js' : {
            'inited' : function() {
                modules.require(['go-game', 'game'], function(GoGame, Game) {
                    GoGame.create(this.domElem, new Game(GAME_SIZE));
                }.bind(this));
            }
        }
    }
}));

});
