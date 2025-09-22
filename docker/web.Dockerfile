FROM node:18-alpine

WORKDIR /app

COPY web/package.json ./package.json
RUN npm install

COPY web .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
