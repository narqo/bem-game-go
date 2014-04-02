modules.define('spec', ['game'], function(provide, Game) {

describe('game', function() {
    var game,
        gameSize = 5;

    beforeEach(function() {
        game = new Game(gameSize);
    });

    describe('initial state', function() {
        it('should has 3 different states', function() {
            Game.EMPTY.should.not.be.equal(Game.BLACK);
            Game.BLACK.should.not.be.equal(Game.WHITE);
            Game.WHITE.should.not.be.equal(Game.EMPTY);
        });

        //it('should return proper game size', function() {
        //    game.getSize().should.be.equal(gameSize);
        //});

        it('should not become over from the beginning', function() {
            game.isGameOver().should.not.be.true;
        });

        it('should return proper current color at the beginning', function() {
            game.getCurrentColor().should.be.equal(Game.BLACK);
        });

        it('should be completely empty at the beginning', function() {
            for(var col = 0; col < gameSize; col++) {
                for(var row = 0; row < gameSize; row++) {
                    game.getStateByPos(col, row).should.be.equal(Game.EMPTY);
                }
            }
        });

        it('initial score should be zeros', function() {
            game.getScore().should.be.eql([0, 0]);
        });
    });

    describe('#play()', function() {
        it('should be possible/impossible to make a proper/improper turn', function() {
            var currentColor = game.getCurrentColor();

            game.play(0, 0).should.be.true;
            game.getStateByPos(0, 0).should.be.equal(currentColor);

            game.play(0, 0).should.be.false;
            game.getStateByPos(0, 0).should.be.equal(currentColor);
        });

        it('should/should not switch players after proper/improper turn', function() {
            var firstColor = game.getCurrentColor();

            game.play(0, 0);

            var nextColor = game.getCurrentColor();
            nextColor.should.not.be.equal(firstColor);

            game.play(1, 0);
            game.getCurrentColor().should.be.equal(firstColor);
        });
    });

    describe('#getStateByPos()', function() {
        it('should return proper state for position', function() {
            var color = game.getCurrentColor();

            game.play(0, 0);
            game.getStateByPos(0, 0).should.be.equal(color);

            color = game.getCurrentColor();
            game.play(1, 1);
            game.getStateByPos(1, 1).should.be.equal(color);

            color = game.getCurrentColor();
            game.play(2, 2);
            game.getStateByPos([2, 2]).should.be.equal(color);
        });
    });

    describe('capturing', function() {
        it('should capture stones with out liberties', function() {
            //   0 1 2
            // 0 + + o
            // 1 + + o
            // 2 o o
            game.play(0, 0).should.be.true;
            game.play(2, 0).should.be.true;
            game.play(0, 1).should.be.true;
            game.play(2, 1).should.be.true;
            game.play(1, 0).should.be.true;
            game.play(1, 2).should.be.true;
            game.play(1, 1).should.be.true;
            game.play(0, 2).should.be.true;

            var empty = Game.EMPTY;
            for(var col = 0; col < 2; col++)
                for(var row = 0; row < 2; row++) {
                    game.getStateByPos(col, row).should.be.equal(empty);
                }
        });

        it('should not allow to make a suicide turn', function() {
            //   0 1 2
            // 0 + o *
            // 1 o
            game.play(0, 0);
            game.play(1, 0);
            game.play(2, 0);
            game.play(0, 1);

            game.getStateByPos(0, 0).should.be.equal(Game.EMPTY);
            game.play(0, 0).should.be.false;
        });
    });

    describe('#pass()', function() {
        it('should be possible to pass a turn', function() {
            var firstColor = game.getCurrentColor();
            game.play(0, 0);
            game.pass();
            game.getCurrentColor().should.be.equal(firstColor);

            game.play(1, 1);
            game.pass();
            game.getCurrentColor().should.be.equal(firstColor);
        });

        it('should end the game if both players pass', function() {
            game.isGameOver().should.be.false;
            game
                .pass()
                .pass();
            game.isGameOver().should.be.true;
        });
    });

    describe('#endGame()', function() {
        it('should be possible to end the game', function() {
            game.isGameOver().should.be.false;
            game.endGame();
            game.isGameOver().should.be.true;
        });
    });
});

provide();

});
