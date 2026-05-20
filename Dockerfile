FROM node:20-alpine

# Baileys needs git and native build tools.
# Prisma on Alpine (musl libc) needs openssl.
RUN apk add --no-cache git python3 make g++ openssl openssl-dev

WORKDIR /app

# Copy package files first so Docker can cache this layer.
# npm ci is stricter than npm install — uses exact versions from package-lock.json.
COPY package*.json ./
RUN npm ci

COPY . .

# Generate the Prisma client for the linux-musl target (Alpine)
RUN npx prisma generate

# Compile TypeScript → JavaScript
RUN npm run build

EXPOSE 3000

# Migrations run at startup (via docker-compose command), then the app starts
CMD ["node", "dist/main"]
