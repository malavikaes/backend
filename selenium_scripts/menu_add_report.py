print('DEBUG: Script started.')

import os
import sys
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.chrome.options import Options as ChromeOptions
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = "https://myblocks.in/login"
MENU_OPTION = "Add Report"

# --- Utility functions ---
def load_credentials(credentials_file):
    if not os.path.exists(credentials_file):
        print(f"Error: Credentials file '{credentials_file}' not found!")
        sys.exit(1)
    credentials = {}
    with open(credentials_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                key, value = line.split('=', 1)
                credentials[key.strip()] = value.strip()
    if 'username' not in credentials or 'password' not in credentials:
        print("Error: Credentials file must contain 'username' and 'password' fields!")
        sys.exit(1)
    return credentials

def load_report_data(report_file):
    if not os.path.exists(report_file):
        print(f"Error: Report data file '{report_file}' not found!")
        sys.exit(1)
    report_data = {}
    with open(report_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                key, value = line.split('=', 1)
                report_data[key.strip()] = value.strip()
    return report_data

def setup_driver():
    options = ChromeOptions()
    options.add_argument("--start-maximized")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)
    return driver

def login_and_select_menu(driver, credentials):
    driver.get(BASE_URL)
    wait = WebDriverWait(driver, 20)
    # Login steps
    wait.until(EC.visibility_of_element_located((By.XPATH, "//*[text()='Discover Your Town']")))
    username_field = wait.until(EC.visibility_of_element_located((By.ID, "username")))
    username_field.send_keys(credentials['username'])
    password_field = wait.until(EC.visibility_of_element_located((By.ID, "password")))
    password_field.send_keys(credentials['password'])
    # Automatically select 'Business User' in the dropdown
    try:
        # Try common selectors for the dropdown
        dropdown = None
        try:
            dropdown = wait.until(EC.presence_of_element_located((By.NAME, 'userType')))
        except:
            try:
                dropdown = wait.until(EC.presence_of_element_located((By.ID, 'userType')))
            except:
                # Fallback: find first select element
                dropdown = wait.until(EC.presence_of_element_located((By.TAG_NAME, 'select')))
        select = Select(dropdown)
        select.select_by_visible_text('Business User')
        print("Selected 'Business User' in dropdown.")
    except Exception as e:
        print(f"Could not select 'Business User' in dropdown: {e}")
    try:
        print("Looking for Login button...")
        login_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[text()='Login']")))
        # Scroll the login button into view before clicking
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", login_button)
        time.sleep(0.5)  # Wait for scroll animation
        print("Clicking Login button...")
        login_button.click()
    except Exception as e:
        print(f"Could not find or click Login button: {e}")
        driver.save_screenshot("error_login_button.png")
        return False
    # Wait for and click 'Business App'
    try:
        business_app_elem = WebDriverWait(driver, 30).until(
            EC.element_to_be_clickable((By.XPATH, "//*[contains(text(), 'Business App')]"))
        )
        print("Found 'Business App'. Clicking...")
        business_app_elem.click()
    except Exception as e:
        print(f"Could not find or click 'Business App': {e}")
        driver.save_screenshot("error_business_app.png")
        return False
    # Wait for and click 'Add Report'
    try:
        menu_elem = WebDriverWait(driver, 30).until(
            EC.element_to_be_clickable((By.XPATH, f"//*[text()='{MENU_OPTION}']"))
        )
        print(f"Found '{MENU_OPTION}'. Clicking...")
        menu_elem.click()
        return True
    except Exception as e:
        print(f"Could not find or click '{MENU_OPTION}': {e}")
        driver.save_screenshot(f"error_{MENU_OPTION.replace(' ', '_').lower()}.png")
        return False

def fill_report_form(driver, report_data):
    wait = WebDriverWait(driver, 20)
    time.sleep(5)  # Wait for form to load
    # Mapping from my_report.txt keys to HTML form field names
    field_map = {
        'created_date': 'createdDate',
        'project_id': 'projectID',
        'type': 'type',
        'report_type': 'reportType',
        'task': 'task',
        'description': 'description',
        'status': 'status',
        'time': 'time',
        'action_numbers': 'actionNumbers',
        'result_numbers': 'resultNumbers',
        'remarks': 'remarks',
        'task_type': 'taskType',
        'task_baseline': 'baseline',
        'start_time': 'startTime',
        'end_time': 'endTime',
        'cr_id': 'crID',
        'task_id': 'taskID',
    }
    # Helper to fill text fields by name
    def fill_text_field(field, value):
        try:
            elem = wait.until(EC.presence_of_element_located((By.NAME, field)))
            elem.clear()
            elem.send_keys(value)
            print(f"Filled {field}")
        except Exception:
            print(f"Could not fill {field}")
    # Helper to select dropdowns by name and value
    def select_dropdown(field, value):
        try:
            elem = wait.until(EC.presence_of_element_located((By.NAME, field)))
            select = Select(elem)
            select.select_by_value(value)
            print(f"Selected {value} for {field}")
        except Exception:
            print(f"Could not select {value} for {field}")
    # Dropdown fields in the HTML
    dropdown_fields = [
        'projectID', 'type', 'reportType', 'status', 'taskType', 'baseline', 'crID'
    ]
    # Value normalization for dropdowns
    def normalize_dropdown_value(field, value):
        if field == 'projectID':
            # Extract numeric part if value is like '828-myblock'
            return value.split('-')[0].strip()
        if field == 'crID':
            # Extract numeric part if value is like 'CR12'
            if value.upper().startswith('CR'):
                return value[2:]
            return value
        if field == 'reportType':
            # Map to HTML values (Daily Plan -> Dailyplan, etc.)
            mapping = {
                'Daily Plan': 'Dailyplan',
                'Daily Report': 'Dailyreport',
                'Action Plan': 'Actionplan',
                'Result': 'Result',
                'Timesheet': 'Timesheet',
            }
            return mapping.get(value, value)
        if field == 'type':
            mapping = {
                'Ticket': 'Ticket',
                'ChangeRequest': 'CR',
                'Project': 'Project',
            }
            return mapping.get(value, value)
        if field == 'status':
            mapping = {
                'Complete': 'complete',
                'Pending': 'pending',
            }
            return mapping.get(value, value)
        if field == 'taskType':
            mapping = {
                'Technical': 'Technical',
                'Operations': 'Operations',
            }
            return mapping.get(value, value)
        if field == 'baseline':
            mapping = {
                'Small': 'Small',
                'Medium': 'Medium',
                'Large': 'Large',
            }
            return mapping.get(value, value)
        return value
    # Fill fields
    for key, value in report_data.items():
        html_field = field_map.get(key)
        if not html_field:
            continue
        if html_field in dropdown_fields:
            dropdown_value = normalize_dropdown_value(html_field, value)
            select_dropdown(html_field, dropdown_value)
        else:
            fill_text_field(html_field, value)
    # Click Submit
    try:
        submit_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Submit')]")))
        submit_btn.click()
        print("Clicked Submit button.")
    except Exception:
        print("Could not click Submit button.")
    print("All possible fields filled and submitted. Script complete.")
    time.sleep(5)

def main():
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Use absolute paths for the files
    credentials_file = os.path.join(script_dir, 'my_credentials.txt')
    report_file = os.path.join(script_dir, 'my_report.txt')
    
    credentials = load_credentials(credentials_file)
    report_data = load_report_data(report_file)
    driver = setup_driver()
    try:
        if login_and_select_menu(driver, credentials):
            fill_report_form(driver, report_data)
    finally:
        driver.quit()
        print("Browser closed.")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f'ERROR: {e}') 