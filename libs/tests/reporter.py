import re
import sys
import time
from selenium import webdriver
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.chrome.options import Options

# Configure WebDriver to capture browser logs
capabilities = DesiredCapabilities.CHROME
capabilities["goog:loggingPrefs"] = {"browser": "ALL"}

# Create Chrome options and enable headless mode
chrome_options = Options()
chrome_options.add_argument("--headless=new")

# Create a Chrome Service object
chrome_service = ChromeService(executable_path="path/to/chromedriver")

# Create a new instance of the Chrome WebDriver using the Chrome Service object and options
driver = webdriver.Chrome(service=chrome_service, options=chrome_options, desired_capabilities=capabilities)

# Navigate to the desired URL
driver.get("http://localhost:3000/")

# Function to capture console.log messages and return the number of failed tests
def capture_console_logs(driver):
    logs = driver.get_log("browser")
    for log in logs:
        if log["level"] == "INFO":
            message = log["message"]
            print(message)
            match = re.search(r"(\d+) passed, (\d+) failed", message)
            if match:
                return int(match.group(2))
    return None

# Poll for the desired message in console.log
failed_tests = None
while True:
    time.sleep(1)
    failed_tests = capture_console_logs(driver)
    if failed_tests is not None:
        break

# Close the browser
driver.quit()

# Exit with an appropriate status code based on the number of failed tests
if failed_tests > 0:
    sys.exit(1)
else:
    sys.exit(0)
