FROM node:24-alpine3.24

WORKDIR /app

RUN npm install http-server @tailwindcss/cli tailwindcss

COPY . .

EXPOSE 8080

CMD ["http-server", "."]