FROM node:24-alpine3.24

WORKDIR /app

RUN npm install http-server @tailwindcss/cli tailwindcss

COPY . .

RUN npx @tailwindcss/cli -i ./css/input.css -o ./css/output.css

EXPOSE 8080

CMD ["sh", "-c", "npx http-server . -p ${PORT:-8080} -c-1"]