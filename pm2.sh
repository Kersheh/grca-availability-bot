#!/bin/bash

case "$1" in
  start)
    npx pm2 start ecosystem.config.js
    ;;
  stop)
    npx pm2 stop ecosystem.config.js
    ;;
  logs)
    npx pm2 logs
    ;;
  ls|list)
    npx pm2 list
    ;;
  daemon)
    npx pm2 delete all
    npx pm2 start ecosystem.config.js
    npx pm2 save
    npx pm2 startup
    ;;
  *)
    echo "Usage: $0 {start|stop|logs|ls|list|daemon}"
    exit 1
    ;;
esac