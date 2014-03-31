modules.define(
    'go-game',
    ['i-bem__dom', 'BEMHTML', 'jquery', 'board', 'alert', 'players-list', 'pass-button'],
    function(provide, BEMDOM, BEMHTML, $, Board, Alert, PlayersList, PassButton) {

var block = this.name;

provide(BEMDOM.decl(block, {
    onSetMod : {
        'js' : {
            'inited' : function() {
                this._game = null;
                this._alert = null;
                this._board = null;
                this._playersList = null;
            }
        }
    },

    _getGame : function() {
        return this._game;
    },

    _setGame : function(game) {
        this._game = game;
        return this;
    },

    _getAlert : function() {
        return this._alert || (this._alert = this.findBlockInside('alert'));
    },

    _getBoard : function() {
        return this._board || (this._board = this.findBlockInside('board'));
    },

    _getPlayersList : function() {
        return this._playersList ||
            (this._playersList = this.findBlockInside('players-list'));
    },

    _notify : function() {
        var game = this._getGame(),
            alert = this._getAlert(),
            msg;

        if(game.isGameOver())
            msg = 'GAME OVER';
        else if(game.isInAtari())
            msg = 'ATARI';
        else if(game.isAttemptedSuicide())
            msg = 'SUICIDE';

        msg?
            alert.show(msg) :
            alert.hide();
    },

    _onPlay : function(e, data) {
        var game = this._getGame(),
            isPlayed = game.play(data.col, data.row);

        this._notify();

        if(isPlayed) {
            this._getBoard().update(game);
            this._getPlayersList().update(game);
        }
    },

    _onPassClick : function() {
        this._getPlayersList().update(this._getGame().pass());
        this._notify();
    }
}, {
    live : function() {
        this
            .liveInitOnBlockInsideEvent('play', 'board', function(e, data) {
                this._onPlay(e, data);
            })
            .liveInitOnBlockInsideEvent('click', 'pass-button', function() {
                this._onPassClick();
            });
    },

    create : function(game) {
        return $(BEMHTML.apply(this.build(game)))
            .bem(block)
            ._setGame(game);
    },

    build : function(game) {
        return {
            block : block,
            content : [
                { elem : 'notification', content : Alert.build(game) },
                { elem : 'board', content : Board.build(game) },
                { elem : 'info', content : [
                    PlayersList.build(game),
                    PassButton.build(game)
                ] }
            ]
        };
    }
}));

});
