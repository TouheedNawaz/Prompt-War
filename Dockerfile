# =============================================================
# VenueIQ — Dockerfile
# Deploys to Google Cloud Run as a static site via nginx
# =============================================================

FROM nginx:alpine

# Install bash for the entrypoint script
RUN apk add --no-cache bash

# Copy nginx config (listens on port 8080 for Cloud Run)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy app files (config.js is excluded via .dockerignore — 
# it is generated at runtime by docker-entrypoint.sh)
COPY index.html       /usr/share/nginx/html/
COPY config.example.js /usr/share/nginx/html/
COPY css/             /usr/share/nginx/html/css/
COPY js/              /usr/share/nginx/html/js/
COPY README.md        /usr/share/nginx/html/

# Entrypoint: generates config.js from env vars, then starts nginx
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Cloud Run requires port 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
