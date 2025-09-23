#!/bin/bash
echo "Loading Traffic Router Docker images..."
for image in *.tar.gz; do
    echo "Loading $image..."
    docker load < "$image"
done
echo "All images loaded successfully!"
