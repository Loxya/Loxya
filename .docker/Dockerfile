# check=skip=SecretsUsedInArgOrEnv

FROM php:8.3-fpm-alpine AS app-base
WORKDIR /

LABEL description="Application de gestion de location de matériel simple, efficace, modulable et open-source."
LABEL maintainer="Loxya Team <technical@loxya.com>"

ENV TZ=Europe/Paris

# - Persistent / Runtime dependencies
RUN set -eux; \
    apk add --no-cache \
        curl \
        nginx \
        supervisor \
        tzdata \
        unzip \
        dcron \
        logrotate \
        jq;

# - User / Group "loxya"
RUN set -eux; \
    addgroup -S loxya; \
    mkdir -p /home/loxya; \
    adduser -S -D -H -h /home/loxya -s /sbin/nologin -G loxya -g loxya loxya; \
    addgroup loxya www-data; \
    chown -R loxya:loxya /home/loxya; \
    chown -R loxya:loxya /run;

# - Rotation des logs
COPY ./config/logrotate /etc/logrotate.d/loxya

# - PHP Extension Installer
COPY --from=mlocati/php-extension-installer:2.8.5 /usr/bin/install-php-extensions /usr/local/bin/

# - PHP extensions
RUN \
    --mount=type=cache,target=/var/cache/apt \
    install-php-extensions \
        apcu \
        bcmath \
        curl \
        dom \
        fileinfo \
        gd \
        gettext \
        iconv \
        imagick \
        intl \
        json \
        mbstring \
        mysqli \
        opcache \
        openssl \
        pcre \
        pdo \
        pdo_mysql \
        soap \
        sockets \
        ssh2 \
        xml \
        xsl \
        zip

# - PHP Configuration
COPY ./config/php.ini ${PHP_INI_DIR}/conf.d/custom.ini
COPY ./config/php-fpm.conf /usr/local/etc/php-fpm.conf
RUN set -eux; \
    mv ${PHP_INI_DIR}/php.ini-production ${PHP_INI_DIR}/php.ini; \
    rm -r \
        ${PHP_INI_DIR}/php.ini-development \
        /usr/local/etc/php-fpm.conf.default \
        /usr/local/etc/php-fpm.d;

# - Nginx Configuration
COPY ./config/nginx.conf /etc/nginx/nginx.conf
COPY ./config/vhosts/default.conf /etc/nginx/vhosts/default.conf
RUN set -eux; \
    rm -rf \
        /var/www \
        /etc/nginx/modules \
        /etc/nginx/http.d; \
    chown -R loxya:loxya \
        /etc/nginx/vhosts \
        /var/lib/nginx \
        /var/log/nginx;

# - Supervisor configuration
COPY ./config/supervisord.conf /etc/supervisord.conf

# - Loxya base directories
RUN set -eux; \
    mkdir -p \
        /opt/loxya \
        /var/loxya/logs; \
    chown -R loxya:loxya \
        /opt/loxya \
        /var/loxya; \
    chmod -R 2770 \
        /opt/loxya \
        /var/loxya;

EXPOSE 80

# @see https://github.com/Supervisor/supervisor/issues/1683#issuecomment-2931600963
ENV PYTHONWARNINGS="ignore"
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]

HEALTHCHECK --timeout=10s CMD curl --silent --fail http://127.0.0.1/php-ping || exit 1

FROM app-base AS app-dev

# - Nginx dev. configuration
COPY ./config/vhosts/default.dev.conf /etc/nginx/vhosts/default.conf

# - Composer
COPY --from=composer:2.8.10 /usr/bin/composer /usr/bin/composer

# - Working dir
WORKDIR /opt/loxya

FROM app-base AS app-release

RUN set -eux; \
    mkdir -p \
        /etc/loxya \
        /tmp/loxya \
        /var/loxya/data \
        /var/loxya/cache \
        /var/loxya/data/bills \
        /var/loxya/data/imports \
        /var/loxya/data/materials; \
    chown -R loxya:loxya \
        /etc/loxya \
        /tmp/loxya \
        /var/loxya; \
    chmod -R 2770 \
        /etc/loxya \
        /tmp/loxya \
        /var/loxya;

# - Copie des sources
COPY --chown=loxya:loxya --from=source . /opt/loxya
RUN set -eux; \
    rm -rf \
        /opt/loxya/data \
        /opt/loxya/src/var/logs \
        /opt/loxya/src/var/cache \
        /opt/loxya/src/var/tmp \
        /opt/loxya/src/App/Config/install.json \
        /opt/loxya/src/App/Config/settings.json; \
    ln -snf /var/loxya/data /opt/loxya/data; \
    ln -snf /tmp/loxya /opt/loxya/src/var/tmp; \
    ln -snf /var/loxya/logs /opt/loxya/src/var/logs; \
    ln -snf /var/loxya/cache /opt/loxya/src/var/cache; \
    ln -snf /etc/loxya/install.json /opt/loxya/src/App/Config/install.json; \
    ln -snf /etc/loxya/settings.json /opt/loxya/src/App/Config/settings.json;

VOLUME ["/etc/loxya", "/var/loxya"]

COPY --chmod=0750 ./entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

# @see https://github.com/Supervisor/supervisor/issues/1683#issuecomment-2931600963
ENV PYTHONWARNINGS="ignore"
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
