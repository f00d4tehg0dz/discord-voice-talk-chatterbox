# Use Node.js LTS version
FROM node:20-slim

# Install system dependencies including ffmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy app source
COPY . .

# Create directories for temporary files
RUN mkdir -p temp

# Set environment variables
ENV NODE_ENV=production

# Start the bot
CMD ["node", "index.js"] 