# Let's Go! With BEM [![Build Status](https://travis-ci.org/narqo/bem-game-go.svg?branch=master)](https://travis-ci.org/narqo/bem-game-go) [![Coverage Status](https://coveralls.io/repos/narqo/bem-game-go/badge.png?branch=master)](https://coveralls.io/r/narqo/bem-game-go?branch=master)

A port of "[React beginner tutorial: implementing the board game Go][1]" on top of [bem-core][1] library.

## How to build

0\. Clone the repo

```
› git clone https://github.com/narqo/bem-game-go.git
› cd bem-game-go
```

1\. Install dependencies

```
› npm install
› bower-npm-install
```

2\. Run dev server

```
› bem server -p 3001
```

After that it should be posible to open game's page in the browser under the URL `http://localhost:3001/bundles/index/index.html`

## Development

After all dependencies were installed, run:

```
› npm test
```

This will build all specs files and process them throgh the [PhantomJS][3] headless browser.

## License

WTFPL

[1]: http://cjlarose.com/2014/01/09/react-board-game-tutorial.html
[2]: https://github.com/bem/bem-core/
[3]: http://phantomjs.org

