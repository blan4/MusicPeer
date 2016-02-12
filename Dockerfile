FROM node:5.6

RUN mkdir /app
WORKDIR /app
ADD package.json /app/package.json
RUN npm install --production
