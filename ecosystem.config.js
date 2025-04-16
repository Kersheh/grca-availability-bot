module.exports = {
  apps: [{
    name: "grca-availability-bot",
    script: "npm run prod",
    autorestart: false,
    time: true,
    cron_restart: "0,30 * * * *"
  }]
}
