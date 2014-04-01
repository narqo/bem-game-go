#!/usr/bin/env bash

./node_modules/.bin/bem make bundles
mkdir -p gh-pages
cd gh-pages
git init
git config --global user.name "Travis CI"
git config --global user.email "travis@travis-ci.org"
cp -f ../bundles/index/index.html ./
cp -f ../bundles/index/_index.css ./
cp -f ../bundles/index/_index.js  ./
# Commit and Push the Changes
git add -f .
git commit -m "Lastest bundle on successful travis build $TRAVIS_BUILD_NUMBER auto-pushed to gh-pages"
git push --force --quiet "https://${GH_TOKEN}@${GH_REF}" master:gh-pages > /dev/null 2>&1

