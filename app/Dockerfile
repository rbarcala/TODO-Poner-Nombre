FROM node:20-alpine

WORKDIR /app

RUN npm install http-server @tailwindcss/cli tailwindcss

COPY . .

EXPOSE 8080

CMD ["http-server", "."]