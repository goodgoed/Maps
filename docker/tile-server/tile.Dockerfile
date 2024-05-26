# Arguments
ARG libmapnik_version=3.1
ARG runner_additional_packages
ARG ubuntu_version=22.04

# Builder
FROM ubuntu:${ubuntu_version} as builder

## Arguments
ARG ubuntu_version

## Install builder dependencies
RUN --mount=id=ubuntu:${ubuntu_version}-/var/cache/apt,sharing=locked,target=/var/cache/apt,type=cache \
    --mount=id=ubuntu:${ubuntu_version}-/var/lib/apt,sharing=locked,target=/var/lib/apt,type=cache \
    export DEBIAN_FRONTEND=noninteractive && \
    apt-get --yes update && \
    apt-get --yes upgrade && \
    apt-get --no-install-recommends --yes install \
        ca-certificates \
        apache2 \
        apache2-dev \
        cmake \
        curl \
        g++ \
        gcc \
        libcairo2-dev \
        libcurl4-openssl-dev \
        libglib2.0-dev \
        libiniparser-dev \
        libmapnik-dev \
        libmemcached-dev \
        librados-dev \
        netbase \
        git

## Build, Test & Install `mod_tile`
RUN rm -rf /tmp/mod_tile_src /tmp/mod_tile_build && \
    mkdir -p /tmp/mod_tile_src /tmp/mod_tile_src && \
    git clone --depth 1 https://github.com/openstreetmap/mod_tile.git /tmp/mod_tile_src
RUN export CMAKE_BUILD_PARALLEL_LEVEL=$(nproc) && \
    cmake -B . -S /tmp/mod_tile_src \
        -DCMAKE_BUILD_TYPE:STRING=Release \
        -DCMAKE_INSTALL_LOCALSTATEDIR=/var \
        -DCMAKE_INSTALL_PREFIX=/usr \
        -DCMAKE_INSTALL_RUNSTATEDIR=/run \
        -DCMAKE_INSTALL_SYSCONFDIR=/etc \
        -DENABLE_TESTS:BOOL=ON && \
    cmake --build .
RUN export CTEST_PARALLEL_LEVEL=$(nproc) && \
    export DESTDIR=/tmp/mod_tile && \
    ctest --output-on-failure && \
    (cmake --install . --strip || make DESTDIR=${DESTDIR} install/strip)

# Runner
FROM ubuntu:${ubuntu_version} as runner

## Arguments
ARG libmapnik_version=3.1
ARG runner_additional_packages
ARG ubuntu_version=22.04

## Install runner dependencies
RUN --mount=id=ubuntu:${ubuntu_version}-/var/cache/apt,sharing=locked,target=/var/cache/apt,type=cache \
    --mount=id=ubuntu:${ubuntu_version}-/var/lib/apt,sharing=locked,target=/var/lib/apt,type=cache \
    export DEBIAN_FRONTEND=noninteractive && \
    apt-get --yes update && \
    apt-get --yes upgrade && \
    apt-get --no-install-recommends --yes install ${runner_additional_packages} \
        ca-certificates \
        apache2 \
        libcairo2 \
        libcurl4 \
        libglib2.0-0 \
        libiniparser1 \
        libmapnik${libmapnik_version} \
        libmemcached11 \
        librados2 \
        git \
        wget \
        npm \
        fonts-noto-cjk fonts-noto-hinted fonts-noto-unhinted fonts-unifont fonts-hanazono fonts-dejavu \
        netcat \
        postgresql-client

# Install stylesheet
RUN git clone --single-branch --branch v5.4.0 https://github.com/gravitystorm/openstreetmap-carto.git --depth 1 && cd openstreetmap-carto \
&& sed -i 's/, "unifont Medium", "Unifont Upper Medium"//g' style/fonts.mss \
&& sed -i 's/"Noto Sans Tibetan Regular",//g' style/fonts.mss \
&& sed -i 's/"Noto Sans Tibetan Bold",//g' style/fonts.mss \
&& sed -i 's/Noto Sans Syriac Eastern Regular/Noto Sans Syriac Regular/g' style/fonts.mss \
&& rm -rf .git
RUN npm install -g carto

# Install pre-rendering tool
RUN wget https://raw.githubusercontent.com/alx77/render_list_geo.pl/master/render_list_geo.pl -P /usr/bin && chmod +x /usr/bin/render_list_geo.pl

# Setup remote db connection
RUN sed -i '/osm2pgsql:/a \    host: "db"' /openstreetmap-carto/project.mml && \
sed -i '/host: "db"/a \    user: "postgres"' /openstreetmap-carto/project.mml && \
sed -i '/user: "postgres"/a \    password: "mysecretpassword"' /openstreetmap-carto/project.mml

# Get Noto Emoji Regular font, despite it being deprecated by Google
RUN wget https://github.com/googlefonts/noto-emoji/blob/9a5261d871451f9b5183c93483cbd68ed916b1e9/fonts/NotoEmoji-Regular.ttf?raw=true --content-disposition -P /usr/share/fonts/truetype
RUN wget https://github.com/stamen/terrain-classic/blob/master/fonts/unifont-Medium.ttf?raw=true --content-disposition -P /usr/share/fonts/truetype

# compile XML file
RUN carto -q /openstreetmap-carto/project.mml > /openstreetmap-carto/mapnik.xml

## Copy files from builder(s)
COPY --from=builder /tmp/mod_tile /

## Add configuration
COPY apache.conf /etc/apache2/sites-available/000-default.conf
COPY renderd.conf /etc/renderd.conf

# Create cache directory
RUN mkdir -p /var/cache/tiles

## Enable module & site
RUN a2enmod tile && \
    a2ensite 000-default

COPY ./tile-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]