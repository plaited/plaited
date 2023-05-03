FROM mcr.microsoft.com/devcontainers/javascript-node:0-18
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install git wget curl

# Install Google Chrome
# Chrome dependency Instalation
RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    DEBIAN_FRONTEND=noninteractive apt-get -y install ./google-chrome-stable_current_amd64.deb

RUN rm google-chrome-stable_current_amd64.deb

# Install Bun
RUN npm install -g bun 

# Add chrome to path
RUN export CHROME_PATH="/usr/bin/google-chrome"

# Check chrome version
RUN echo "Chrome: " && google-chrome --version