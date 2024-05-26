FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive

USER root

# Install dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    # Build tools for nominatim and osm2po
    default-jre-headless build-essential g++ cmake libpq-dev zlib1g-dev libbz2-dev libproj-dev libexpat1-dev libboost-dev libboost-system-dev libboost-filesystem-dev liblua5.4-dev nlohmann-json3-dev \
    # postgres
    postgresql-contrib postgresql-server-dev-14 postgresql-14-postgis-3 postgresql-14-postgis-3-scripts postgresql-14-pgrouting \
    # dependencies for nominatim
    python3-dev python3-pip python3-tidylib python3-psycopg2 python3-setuptools python3-dotenv python3-psutil python3-jinja2 python3-sqlalchemy python3-asyncpg python3-datrie python3-icu python3-argparse-manpage \
    # dependencies for tile rendering
    bzip2 lua5.1 python3-mapnik python3-psycopg2 python3-yaml gdal-bin osm2pgsql \
    # fonts for tile rendering
    fonts-noto-cjk fonts-noto-hinted fonts-noto-unhinted fonts-unifont fonts-hanazono \
    # extra tools
    wget unzip dos2unix gzip screen locate git tar curl net-tools sudo netcat && \
    # Clean up
    rm -rf /var/lib/apt/lists/*

# Install nominatim
ENV NOMINATIM_VERSION 4.4.0
RUN curl https://nominatim.org/release/Nominatim-$NOMINATIM_VERSION.tar.bz2 -o nominatim.tar.bz2 \
    && tar xf nominatim.tar.bz2 \
    && mkdir build \
    && cd build \
    && cmake ../Nominatim-$NOMINATIM_VERSION \
    && make -j`nproc` \
    && make install

# Install stylesheet
RUN git clone --single-branch --branch v5.4.0 https://github.com/gravitystorm/openstreetmap-carto.git

# Download osm2po
RUN wget http://osm2po.de/releases/osm2po-5.5.11.zip -O osm2po.zip

# Unzip osm2po
RUN unzip osm2po.zip -d /osm2po && \
    rm osm2po.zip

# Configure postgres.
RUN echo "host all all 0.0.0.0/0 reject" >> /etc/postgresql/14/main/pg_hba.conf \
    && echo "listen_addresses='*'" >> /etc/postgresql/14/main/postgresql.conf \
    && echo "tcp_keepalives_idle = 600" >> /etc/postgresql/14/main/postgresql.conf \
    && echo "tcp_keepalives_interval = 30" >> /etc/postgresql/14/main/postgresql.conf \
    && echo "tcp_keepalives_count = 10" >> /etc/postgresql/14/main/postgresql.conf \
    && echo "max_connections = 3000" >> /etc/postgresql/14/main/postgresql.conf
COPY ./postgres-tuning.conf /etc/postgresql/14/main/conf.d/

COPY ./osm2po.config /osm2po/osm2po.config

COPY ./db-entrypoint.sh /entrypoint.sh

RUN ["chmod", "+x", "/entrypoint.sh"]
RUN dos2unix /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]