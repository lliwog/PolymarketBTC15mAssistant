FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer-cached unless package.json changes)
COPY package.json ./
RUN npm install --omit=dev

# Copy application source
COPY src/ ./src/

# logs/ is intentionally NOT copied — it must be mounted from the host
# so that ta.latest.json is written to the host filesystem.

CMD ["node", "src/index.js"]
