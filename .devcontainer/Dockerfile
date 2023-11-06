FROM oven/bun:latest

RUN apt-get -y update
RUN apt-get -y install git

RUN bunx playwright install

RUN git config --global --add safe.directory /workspaces/plaited