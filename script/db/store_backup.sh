docker exec -i db /bin/bash -c "sudo -u postgres pg_dump -Fc nominatim" | gzip -c > "backup/nominatim.gz" &
docker exec -i db /bin/bash -c "sudo -u postgres pg_dump -Fc gis" | gzip -c > "backup/gis.gz" &

wait
touch backup/backup-complete