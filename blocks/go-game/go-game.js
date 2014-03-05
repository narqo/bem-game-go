modules.define(
    'go-game',
    ['i-bem__dom', 'BEMHTML', 'board', 'alert', 'pass-button', 'game'],
    function(provide, BEMDOM, BEMHTML, Board, Alert, PassButton, Game) {

var GAME_SIZE = 9;

provide(BEMDOM.decl(this.name, {
    onSetMod : {
        js : {
            inited : function() {
                this._game = new Game(GAME_SIZE);

                BEMDOM.update(this.domElem, BEMHTML.apply(this.__self.build(this._game)));

                this._alert = null;
                this._board = this
                    .findBlockInside('board')
                    .on('play', this._onPlay, this);
            }
        }
    },

    _getAlert : function() {
        return this._alert || (this._alert = this.findBlockInside('alert'));
    },

    _notify : function() {
        var game = this._game,
            alert = this._getAlert(),
            msg;

        if(game.isInAtari())
            msg = 'ATARI';
        else if(game.isAttemptedSuicide())
            msg = 'SUICIDE';
        else if(game.isOver())
            msg = 'GAME OVER';

        msg?
            alert.show('ATARI') :
            alert.hide();
    },

    _onPlay : function(e, data) {
        var isPlayed = this._game.play(data.row, data.col);

        this._notify();

        isPlayed && this._board.updateBoard(this._game);
    },

    _onPassClick : function() {
        this._game.pass();
    }
}, {
    live : false,

    build : function(game) {
        return [
            Alert.build(game),
            Board.build(game)
        ]
    }
}));

});
