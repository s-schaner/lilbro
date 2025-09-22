FROM node:20-alpine AS base
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY apps/web ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=base /app/dist ./dist
RUN npm install -g serve
EXPOSE 8080
CMD ["serve", "-s", "dist", "-l", "8080"]
