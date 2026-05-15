FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY ml/requirements.txt ml/
RUN pip3 install --break-system-packages -r ml/requirements.txt
COPY . .
RUN mkdir -p data && node db/migrate.js && python3 ml/train.py
EXPOSE 4000
CMD ["node", "server.js"]
