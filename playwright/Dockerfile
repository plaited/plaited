ARG TAG
FROM mcr.microsoft.com/playwright:$TAG

WORKDIR /tests

COPY .yarn/releases .yarn/releases
COPY .yarn/plugins .yarn/plugins
COPY .yarn/cache .yarn/cache
COPY yarn.lock .
COPY .yarnrc.yml .
COPY package.json .

RUN yarn install --immutable