FROM node:16-alpine

# Install Chrome
RUN echo @edge https://dl-cdn.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories \
  && echo @edge https://dl-cdn.alpinelinux.org/alpine/edge/main >> /etc/apk/repositories \
  && apk -U upgrade \
  && apk add --no-cache \
    chromium@edge \
    nss@edge \
    freetype@edge \
    harfbuzz@edge \
    ttf-freefont@edge \
    libstdc++@edge \
    wayland-libs-client@edge \
    wayland-libs-server@edge \
    wayland-libs-cursor@edge \
    wayland-libs-egl@edge \
    wayland@edge

WORKDIR /app

COPY package*.json ./
COPY src ./src/
COPY config/config.json ./config/config.json
COPY tsconfig.json ./tsconfig.json

RUN npm i

ENTRYPOINT [ "npm", "run", "prod" ]
