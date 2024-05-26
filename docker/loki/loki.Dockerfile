FROM grafana/loki:main

COPY ./loki.conf /etc/loki/local-config.yaml