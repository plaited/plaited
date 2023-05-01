FROM mcr.microsoft.com/devcontainers/javascript-node:0-18
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install git wget curl

# Install Google Chrome
# Chrome dependency Instalation
RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    DEBIAN_FRONTEND=noninteractive apt-get -y install ./google-chrome-stable_current_amd64.deb

RUN rm google-chrome-stable_current_amd64.deb

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash

ENV BUN_INSTALL="$HOME/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

# Check chrome version
RUN echo "Chrome: " && google-chrome --version

