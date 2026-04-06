# Stage 1: Build the app
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./

# Accept JFrog auth token as build arg (set in Railway environment)
ARG NPM_TOKEN
RUN echo "registry=https://outcomehealth.jfrog.io/artifactory/api/npm/remote-npm/" > /app/.npmrc \
    && echo "//outcomehealth.jfrog.io/artifactory/api/npm/remote-npm/:_authToken=$NPM_TOKEN" >> /app/.npmrc \
    && echo "strict-ssl=false" >> /app/.npmrc \
    && npm ci \
    && rm -f /app/.npmrc

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve with Caddy
FROM caddy:2-alpine
COPY --from=build /app/dist/ /srv
COPY Caddyfile /etc/caddy/Caddyfile
