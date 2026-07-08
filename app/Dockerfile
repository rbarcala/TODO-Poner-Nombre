FROM node:20-alpine

WORKDIR /app

RUN npm install -g http-server @tailwindcss/cli

COPY . .

EXPOSE 8080

CMD ["http-server", "."]