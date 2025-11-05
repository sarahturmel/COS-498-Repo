FROM node:lts

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Remove static file copying - nginx will handle this
# COPY public/ ./public/  # Remove this line if it exists

# Expose port (internal to container network)
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
