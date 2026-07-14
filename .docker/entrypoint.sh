#!/bin/sh
set -e

log_error() { printf '\033[0;31m%s\033[0m\n' "$*"; }
log_warning() { printf '\033[38;5;208m%s\033[0m\n' "$*"; }

round() {
    awk "BEGIN { print int($1 + 0.5) }"
}

available_memory() {
    if [ -f /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then
        LIMIT_BYTES=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes)
    elif [ -f /sys/fs/cgroup/memory.max ]; then
        LIMIT_BYTES=$(cat /sys/fs/cgroup/memory.max)
        [ "$LIMIT_BYTES" = "max" ] && LIMIT_BYTES=0
    else
        LIMIT_BYTES=0
    fi

    if [ "$LIMIT_BYTES" -eq 0 ]; then
        LIMIT_MB=$(awk '/MemTotal:/ {print int($2/1024)}' /proc/meminfo)
        if [ "$LIMIT_MB" -gt 1024 ]; then
            LIMIT_MB=1024
        fi
    else
        LIMIT_MB=$((LIMIT_BYTES / 1024 / 1024))
    fi
    echo "$LIMIT_MB"
}

#
# - PHP FPM
#

echo "[Entrypoint] Configuration de PHP-FPM..."

PHP_MEMORY=$(( $(available_memory) - 200 )) # - 200MB: Reserved for the others processes.
MAX_CHILDREN=$(round "$(echo "$PHP_MEMORY / 256" | bc -l)") # - 256MB: `memory_limit` / 2
if [ "$MAX_CHILDREN" -gt 5 ]; then
    MIN_SPARE_SERVERS=$(round "$(echo "$MAX_CHILDREN / 3" | bc -l)")
    MAX_SPARE_SERVERS=$(round "$(echo "$MAX_CHILDREN / 2" | bc -l)")
    START_SERVERS=$(round "$(echo "($MIN_SPARE_SERVERS + $MAX_SPARE_SERVERS) / 2" | bc -l)")
else
    MAX_CHILDREN=5
    MIN_SPARE_SERVERS=1
    MAX_SPARE_SERVERS=3
    START_SERVERS=2
fi
sed -i "s/^pm.max_children =.*/pm.max_children = $MAX_CHILDREN/" "/usr/local/etc/php-fpm.conf"
sed -i "s/^pm.min_spare_servers =.*/pm.min_spare_servers = $MIN_SPARE_SERVERS/" "/usr/local/etc/php-fpm.conf"
sed -i "s/^pm.max_spare_servers =.*/pm.max_spare_servers = $MAX_SPARE_SERVERS/" "/usr/local/etc/php-fpm.conf"
sed -i "s/^pm.start_servers =.*/pm.start_servers = $START_SERVERS/" "/usr/local/etc/php-fpm.conf"

echo "=> Détection de ${PHP_MEMORY}MB de RAM allouable à PHP-FPM, en conséquence:"
echo "   pm.max_children = $MAX_CHILDREN"
echo "   pm.min_spare_servers = $MIN_SPARE_SERVERS"
echo "   pm.max_spare_servers = $MAX_SPARE_SERVERS"
echo "   pm.start_servers = $START_SERVERS"

#
# - Mise en place des tâches CRON
#

echo "[Entrypoint] Génération des tâches CRON..."
LOXYA_CRON_SOURCE="/opt/loxya/src/App/Config/CRON.json"
LOXYA_CRON_PATH="/etc/crontabs/loxya"
if [ -f "$LOXYA_CRON_SOURCE" ]; then
    echo -n '' > "$LOXYA_CRON_PATH" && chmod 640 "$LOXYA_CRON_PATH"
    jq -c '.[]' "$LOXYA_CRON_SOURCE" | while read -r task; do
        time=$(echo "$task" | jq -r '.time // empty')
        command=$(echo "$task" | jq -r '.command')

        if [ -n "$time" ]; then
            case "${time#@}" in
                daily)   schedule="0 0 * * *" ;;
                hourly)  schedule="0 * * * *" ;;
                weekly)  schedule="0 0 * * 0" ;;
                monthly) schedule="0 0 1 * *" ;;
                yearly)  schedule="0 0 1 1 *" ;;
                *)       schedule="@$time" ;;
            esac
        else
            minute=$(echo "$task" | jq -r '.minute // "*"')
            hour=$(echo "$task" | jq -r '.hour // "*"')
            day=$(echo "$task" | jq -r '.day // "*"')
            month=$(echo "$task" | jq -r '.month // "*"')
            weekday=$(echo "$task" | jq -r '.weekday // "*"')
            schedule="$minute $hour $day $month $weekday"
        fi

        full_command="OUTPUT=\`/opt/loxya/bin/console $command 2>&1\` || echo \"[ERROR] \$(date) - \$OUTPUT\" >> /var/loxya/logs/cron.log; exit 0"
        echo "$schedule $full_command" >> "$LOXYA_CRON_PATH"
    done

    if [ ! -s "$LOXYA_CRON_PATH" ]; then
        echo "=> Aucun CRON actif, suppression du fichier CRON."
        rm -f "$LOXYA_CRON_PATH"
    fi
else
    echo "=> Aucun CRON à configurer."
    rm -rf "$LOXYA_CRON_PATH"
fi

#
# - Dossier du socket unix de nginx.
#

mkdir -p /run/loxya
chown loxya:loxya /run/loxya

#
# - Supprime le cache de l'application.
#

echo "[Entrypoint] Suppression du cache de l'application..."
rm -rf /var/loxya/cache/*

#
# - Migrations de la configuration et de la base de données.
#

run_console() {
    su -s /bin/sh -c "/opt/loxya/bin/console $*" loxya
}

echo "[Entrypoint] Migration de la configuration et de la base de données..."
if [ ! -s "/etc/loxya/settings.json" ]; then
    echo "=> Application non configurée, migrations ignorées."
else
    if run_console "migrations:migrate --no-interaction"; then
        migrate_status=0
    else
        migrate_status=$?
    fi

    if [ "$migrate_status" -eq 78 ]; then
        log_warning "=> La configuration est à mettre à jour manuellement via la commande \`console install\`."
    elif [ "$migrate_status" -ne 0 ] && [ "$migrate_status" -ne 3 ]; then
        log_error "=> Échec de la migration de la base de données."
        exit 1
    fi
fi

#
# - Fin de l'entrypoint.
#

exec "$@"
