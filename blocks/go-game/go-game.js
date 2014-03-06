modules.define(
    'go-game',
    ['i-bem__dom', 'BEMHTML', 'board', 'alert', 'pass-button', 'game'],
    function(provide, BEMDOM, BEMHTML, Board, Alert, PassButton, Game) {

var GAME_SIZE = 11,
    PLAYERS_LIST_ID = 'playerslistid1';

provide(BEMDOM.decl(this.name, {
    onSetMod : {
        'js' : {
            'inited' : function() {
                this._game = new Game(GAME_SIZE);

                BEMDOM.update(this.domElem, BEMHTML.apply(this.__self.build(this._game)));

                this._alert = null;
                this._playersList = null;
                this._board = this
                    .findBlockInside('board')
                    .on('play', this._onPlay, this);

                this
                    .findBlockInside('pass-button')
                    .on('click', this._onPassClick, this);
            }
        }
    },

    _getAlert : function() {
        return this._alert || (this._alert = this.findBlockInside('alert'));
    },

    _getPlayersList : function() {
        return this._playersList ||
            (this._playersList = this.findBlockInside('players-list'));
    },

    _notify : function() {
        var game = this._game,
            alert = this._getAlert(),
            msg;

        if(game.isInAtari())
            msg = 'ATARI';
        else if(game.isAttemptedSuicide())
            msg = 'SUICIDE';
        else if(game.isGameOver())
            msg = 'GAME OVER';

        msg?
            alert.show('ATARI') :
            alert.hide();
    },

    _onPlay : function(e, data) {
        var game = this._game,
            isPlayed = game.play(data.col, data.row);

        this._notify();

        if(isPlayed) {
            this._board.updateBoard(game);
            this._getPlayersList().updateInformer(game);
        }
    },

    _onPassClick : function() {
        this.
            _getPlayersList()
            .updateInformer(this._game.pass());
    }
}, {
    live : false,

    build : function(game) {
        var block = this.getName();
        return [
            { block : block, elem : 'board', content : [
                Alert.build(game),
                Board.build(game)
            ] },
            { block : block, elem : 'info', content : [
                {
                    block : 'players-list',
                    js : { id : PLAYERS_LIST_ID },
                    mix : {
                        elem : 'player',
                        mods : { color : 'black', current : true }
                    },
                    content : 'BLACK'
                },
                PassButton.build(game),
                {
                    block : 'players-list',
                    js : { id : PLAYERS_LIST_ID },
                    mix : {
                        elem : 'player',
                        mods : { color : 'white' }
                    },
                    content : 'WHITE'
                }
            ] }
        ];
    }
}));

});
