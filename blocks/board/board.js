modules.define('board', ['i-bem__dom', 'point'], function(provide, BEMDOM, Point) {

/** {Number} size of the grid */
var POINT_SIZE = Point.POINT_SIZE;

provide(BEMDOM.decl(this.name, {
    _getPoints : function() {
        return this._points || (this._points = this.findBlocksInside('point'));
    },

    update : function(game) {
        this._getPoints().forEach(function(point) {
            point.setState(game.getStateByPos(point.getCol(), point.getRow()));
        });
        return this;
    },

    _onPointClick : function(point) {
        this.emit('play', {
            col : point.getCol(),
            row : point.getRow()
        });
    }
}, {
    live : function() {
        this.liveInitOnBlockInsideEvent('click', 'point', function(e) {
            this._onPointClick(e.target);
        });
    },

    build : function(game) {
        var gridSize = game.getSize() * POINT_SIZE;
        return {
            block : this.getName(),
            attrs : {
                style : 'width: ' + gridSize + 'px; height: ' + gridSize + 'px;'
            },
            content : this._fillBoad(game)
        };
    },

    _fillBoad : function(game) {
        var size = game.getSize(),
            lastIdx = size - 1,
            points = [],
            item, mods;

        for(var col = 0; col < size; col++) {
            for(var row = 0; row < size; row++) {
                item = Point.build(game, col, row);
                mods = item.mods || (item.mods = {});

                col === 0 && (mods['first-col'] = true);
                col === lastIdx && (mods['last-col'] = true);

                row === 0 && (mods['first-row'] = true);
                row === lastIdx && (mods['last-row'] = true);

                item.attrs = {
                    style : 'top: ' + col * POINT_SIZE + 'px; left: ' + row * POINT_SIZE + 'px;'
                };

                points.push(item);
            }
        }

        return points;
    }
}));

});
