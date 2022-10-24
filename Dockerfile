ARG TAG
FROM mcr.microsoft.com/playwright:$TAG


WORKDIR /plaited

COPY .yarn/releases .yarn/releases
COPY .yarn/plugins .yarn/plugins
COPY .yarn/cache .yarn/cache
COPY yarn.lock .
COPY .yarnrc.yml .
COPY package.json .
COPY packages/behavioral/package.json packages/behavioral/package.json
COPY packages/actor/package.json packages/actor/package.json
COPY packages/island/package.json packages/island/package.json
COPY packages/utils/package.json packages/utils/package.json

RUN yarn install --immutable