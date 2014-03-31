modules.define('page', ['i-bem__dom'], function(provide, BEMDOM) {

var GAME_SIZE = 11;

provide(BEMDOM.decl(this.name, {
    onSetMod : {
        'js' : {
            'inited' : function() {
                modules.require(['go-game', 'game'], function(GoGame, Game) {
                    BEMDOM.append(
                        this.domElem,
                        GoGame.create(new Game(GAME_SIZE)).domElem);
                }.bind(this));
            }
        }
    }
}));

});
