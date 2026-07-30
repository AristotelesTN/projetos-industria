FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# postinstall runs prisma generate; schema is not present yet in this stage
RUN npm install --ignore-scripts

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh && mkdir -p /app/uploads
EXPOSE 3001
ENTRYPOINT ["/docker-entrypoint.sh"]
