# =============================================================
# VenueIQ — Dockerfile (Node.js Backend)
# =============================================================

FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy application files
COPY . .

# Cloud Run requires port 8080
EXPOSE 8080

CMD ["npm", "start"]
