#!/bin/bash

echo "Waiting for db to start..."
while ! PGPASSWORD=mysecretpassword psql -h db -U postgres -c "SELECT 1" > /dev/null; do
  sleep 10
done

echo "Starting apache2 and renderd"
service apache2 restart
G_MESSAGES_DEBUG=info renderd -f &
# tail -F /var/log/renderd.log /var/log/apache2/access.log /var/log/apache2/error.log &
pid=${!}

wait $pidl