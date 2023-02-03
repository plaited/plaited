export const dockerFile = (pat: boolean) =>
  `ARG TAG
FROM mcr.microsoft.com/playwright:$TAG
${
    pat
      ? `\nARG GIT_PAT
ENV GIT_PAT=\${GIT_PAT}`
      : ''
  }

WORKDIR /tests

COPY .yarn/releases .yarn/releases
COPY .yarn/plugins .yarn/plugins
COPY .yarn/cache .yarn/cache
COPY yarn.lock .
COPY .yarnrc.yml .
COPY package.json .

RUN ${pat ? 'export AUTH=${GIT_PAT} &&' : ''} yarn auth && \
  yarn install --immutable
`
