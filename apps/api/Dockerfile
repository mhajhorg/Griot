FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN cp -n .env.example .env 2>/dev/null || true
EXPOSE 3001
CMD ["node", "src/index.js"]
