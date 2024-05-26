#!/bin/bash

set -e

DB_HOST=$1
MAIN_HOST=$2

java -jar ./fdt.jar -ss 1M -P 10 -r -c $DB_HOST ../../backup/ -d /

ssh -i cse356 root@$DB_HOST 'docker container run --name db -p 5432:5432 -v osm-data:/var/lib/postgresql/14/main -v /backup:/backup --tmpfs /dev/shm:size=2048000000 -d ktao87/cse356:db'

java -jar ./fdt.jar -ss 1M -P 10 -c $MAIN_HOST ../../nginx-cache.tar.gz -d /

ssh -i cse356 root@$MAIN_HOST 'mkdir /var/cache/tiles && tar -xvf /nginx-cache.tar.gz -C /var/cache/tiles --strip-components 1 && chmod -R 777 /var/cache/tiles'

# Try to connect to the database
while ! docker container run --rm -e PGPASSWORD=mysecretpassword postgres:14-bullseye psql -h $DB_HOST -U postgres -d gis -c "SELECT 1" > /dev/null; do
  sleep 60
done

ssh -i cse356 root@$DB_HOST 'docker container rm -f db'

echo "EVERYTHING IS READY. CREATE MORE SERVERS AND CONTINUE TO DEPLOY THE SERVICE by running -- ansible-playbook -i ./inventory.ini ./deploy.yml!"