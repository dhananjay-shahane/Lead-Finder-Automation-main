FROM node:20-bookworm-slim

# Install ca-certificates and procps for process management
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy dependency configs
COPY package*.json ./

# Install dependencies
RUN npm ci

# Install Playwright browser dependencies (specifically Chromium)
RUN npx playwright install chromium --with-deps

# Copy application code
COPY . .

# Build Vite frontend and esbuild server
RUN npm run build

# Expose server port
EXPOSE 3000

# Start Express server
CMD ["npm", "start"]
