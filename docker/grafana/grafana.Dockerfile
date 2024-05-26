FROM grafana/grafana:latest

COPY ./dashboards /etc/grafana/provisioning/dashboards
COPY ./datasources /etc/grafana/provisioning/datasources