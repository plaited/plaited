FROM mcr.microsoft.com/devcontainers/base:bullseye

# Update the package list and install wget, curl, python3, and python3-pip
RUN apt-get update && \
    apt-get install -y python3 python3-pip

# Install Google Chrome
RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    DEBIAN_FRONTEND=noninteractive apt-get -y install ./google-chrome-stable_current_amd64.deb

# Install Selenium
RUN pip install selenium requests
RUN export CHROME_PATH="/usr/bin/google-chrome"

# Cleanup
RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /root/.cache/pip/* && \
    rm ./google-chrome-stable_current_amd64.deb
