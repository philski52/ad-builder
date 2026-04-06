# Stage 1: Build the app
FROM node:20-alpine AS build
WORKDIR /app

# Accept JFrog auth token as build arg (set in Railway environment)
ARG NPM_TOKEN

# Configure npm to use JFrog Artifactory
RUN echo "registry=https://outcomehealth.jfrog.io/artifactory/api/npm/remote-npm/" > .npmrc && \
    echo "//outcomehealth.jfrog.io/artifactory/api/npm/remote-npm/:_authToken=${NPM_TOKEN}" >> .npmrc && \
    echo "strict-ssl=false" >> .npmrc

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Remove .npmrc so token doesn't leak into the final image
RUN rm -f .npmrc

# Stage 2: Serve with Caddy
FROM caddy:2-alpine
COPY --from=build /app/dist/ /srv
COPY Caddyfile /etc/caddy/Caddyfile
