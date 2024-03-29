#!/bin/sh
if [ "$NODE_ENV" = "production" ] || [ "$NODE_ENV" = "staging" ]; then
  forever stopall
  kill -9 $(lsof -i tcp:4000 -t)
  forever -o out.log -e err.log start dist/server.js
else
  NODE_ENV=development nodemon --exec ./node_modules/.bin/babel-node server.js
fi
