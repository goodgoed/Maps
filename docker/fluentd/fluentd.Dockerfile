# Start from the fluentd base image
FROM fluentd

# Switch to root to perform administrative tasks
USER root

# Install the necessary plugins
RUN gem install fluent-plugin-rewrite-tag-filter fluent-plugin-concat fluent-plugin-grafana-loki

# Create necessary directories and adjust permissions
RUN mkdir -p /var/log/fluentd
RUN chown -R fluent:fluent /var/log/fluentd

# Copy the configuration file as root to ensure there are no permission issues
COPY ./fluent.conf /fluentd/etc/