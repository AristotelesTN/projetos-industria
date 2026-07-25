# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Browser reaches Nao on the host-mapped port
ARG VITE_NAO_URL=http://localhost:5005
ENV VITE_NAO_URL=$VITE_NAO_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.d/99-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/99-runtime-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
