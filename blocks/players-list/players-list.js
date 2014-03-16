modules.define('players-list', ['i-bem__dom', 'player', 'game'], function(provide, BEMDOM, Player, Game) {

provide(BEMDOM.decl(this.name, {
    onSetMod : {
        'js' : {
            'inited' : function() {
                this._players = null;
            }
        }
    },

    _getPlayers : function() {
        return this._players ||
            (this._players = this.findBlocksInside('player'));
    },

    update : function(game) {
        var currentColor = game.getCurrentColor(),
            color;
        this._getPlayers().forEach(function(player) {
            color = player.getColor();
            player
                .setVal(game.getScore(color))
                .toggleMod('current', true, '', color === currentColor);
        });
        return this;
    }
}, {
    live : true,

    build : function(game) {
        var playerBlack = this._buildPlayer(game, Game.BLACK),
            playerWhite = this._buildPlayer(game, Game.WHITE);

        playerBlack.mods.current = true;

        return {
            block : this.getName(),
            content : [
                playerBlack,
                playerWhite
            ]
        };
    },

    _buildPlayer : function(game, color) {
        var player = Player.build(game, color);

        player.mods || (player.mods = {});
        (player.mix || (player.mix = [])).push({ block : this.getName(), elem : 'player' });

        return player;
    }
}));

});
