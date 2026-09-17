# --- build stage: everything, including dev deps (needed to compile Next) ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- runtime stage: production deps only, non-root, no source tree ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# `npm ci --omit=dev` keeps eslint/typescript/webpack out of the shipped image
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
# the node image ships an unprivileged `node` user; the panel spawns ssh
# processes, so it should not do that as root (audit P2-13)
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["npm", "start"]
