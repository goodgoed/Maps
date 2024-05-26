FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive

USER root

# Install dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends cmake build-essential g++ cmake libpq-dev zlib1g-dev libbz2-dev libproj-dev libexpat1-dev libboost-dev libboost-system-dev libboost-filesystem-dev liblua5.3-dev lua5.3 lua-dkjson nlohmann-json3-dev python3-pip python3-psycopg2 python3-psutil python3-jinja2 python3-sqlalchemy  python3-asyncpg python3-icu python3-datrie python3-yaml python3-dotenv tar curl ca-certificates 

# Install nominatim
ENV NOMINATIM_VERSION 4.4.0
RUN curl https://nominatim.org/release/Nominatim-$NOMINATIM_VERSION.tar.bz2 -o nominatim.tar.bz2 \
    && tar xf nominatim.tar.bz2 \
    && mkdir build \
    && cd build \
    && cmake ../Nominatim-$NOMINATIM_VERSION \
    && make -j`nproc` \
    && make install
    
# Setup application
WORKDIR /code
ENV PYTHONPATH /usr/local/lib/nominatim/lib-python
COPY ./requirements.txt /code/requirements.txt
RUN pip3 install --no-cache-dir --upgrade -r /code/requirements.txt
COPY ./main.py /code/main.py
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "80", "--forwarded-allow-ips", "*"]