# Use Node.js 20 LTS Alpine for smaller image size
FROM node:20-alpine

# Install system dependencies for audio processing
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    libc6-compat

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S discord-bot -u 1001

# Change ownership of app directory
RUN chown -R discord-bot:nodejs /app

# Switch to non-root user
USER discord-bot

# Expose port (if needed for health checks)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "console.log('Bot is running')" || exit 1

# Start the bot
CMD ["node", "index.js"]