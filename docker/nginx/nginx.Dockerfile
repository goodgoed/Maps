FROM nginx:latest

RUN mkdir -p /var/cache/tiles

COPY ./placeholder.png /placeholder.png

COPY ./nginx.conf /etc/nginx/nginx.conf