FROM node:20-alpine
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Build Vite frontend and compile server.ts to dist/server.cjs
RUN npm run build

# Set production environment and default port
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start Express server
CMD ["node", "dist/server.cjs"]
