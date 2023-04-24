import re
import sys
import time
import json
import requests
from selenium import webdriver
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.chrome.options import Options

# Function to run tests on the specified URL
def run_test(url):
    # Navigate to the desired URL
    driver.get(url)

    # Poll for the desired message in console.log
    failed_tests = None
    while True:
        time.sleep(1)
        failed_tests = capture_console_logs(driver)
        if failed_tests is not None:
            break

    return failed_tests

# Function to capture console.log messages and return the number of failed tests
def capture_console_logs(driver):
    logs = driver.get_log("browser")
    for log in logs:
        if log["level"] == "ERROR":
            print(f"Error: {log['message']}")
        elif log["level"] == "INFO":
            message = log["message"]
            print(message)
            match = re.search(r"(\d+) passed, (\d+) failed", message)
            if match:
                return int(match.group(2))
    return None

# Fetch test paths from the server
response = requests.get("http://localhost:3000/tests")
test_data = json.loads(response.text)

# Configure WebDriver to capture browser logs
capabilities = DesiredCapabilities.CHROME
capabilities["goog:loggingPrefs"] = {"browser": "ALL"}

# Create Chrome options
chrome_options = Options()
# This option enables Chrome's new headless mode that allows users to get the full browser functionality (even run extensions)
chrome_options.add_argument("--headless=new")
#This option disables the sandbox security feature, which can cause issues when running Chrome inside a Docker container.
chrome_options.add_argument('--no-sandbox')
# This option tells Chrome to use memory more efficiently, which can help prevent crashes when running inside a Docker container.
chrome_options.add_argument('--disable-dev-shm-usage')

# Create a Chrome Service object
chrome_service = ChromeService(executable_path="path/to/chromedriver")

# Create a new instance of the Chrome WebDriver using the Chrome Service object and options
driver = webdriver.Chrome(service=chrome_service, options=chrome_options, desired_capabilities=capabilities)

# Initialize test result variables
total_passed = 0
total_failed = 0

# Run tests on each path
for test in test_data:
    path = test['path']
    name = test['name']
    url = f"http://localhost:3000{path}"
    failed_tests = run_test(url)
    passed_tests = 1 - failed_tests
    total_passed += passed_tests
    total_failed += failed_tests
    print(f"{name}: {passed_tests} passed, {failed_tests} failed")

# Close the browser
driver.quit()

# Print test results
print(f"Total: {total_passed} passed, {total_failed} failed")

# Exit with an appropriate status code based on the number of failed tests
if total_failed > 0:
    sys.exit(1)
else:
    sys.exit(0)
