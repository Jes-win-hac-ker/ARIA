# ARIA frontend — Vite + React dev server image.
# The compose command runs `npm install && npm run dev`, so this image mainly
# provides a pinned Node runtime; code is bind-mounted in development.
FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
