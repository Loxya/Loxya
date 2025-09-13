# Contributing nodes

## First start

### Start the project backend

```shell
touch .env
docker compose up -d
docker compose exec loxya sh
cd server
composer install
```

### Start the frontend

```
cd client/
npm install
npm run serve
```

### Follow the install process

Go to http://localhost and follow the install process.


## Debugging tasks

### View the logs

```shell
docker compose exec loxya sh
tail -f /var/loxya/logs/*.log
```
