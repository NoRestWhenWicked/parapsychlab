
from playwright.sync_api import sync_playwright

def verify_uap_tracker():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            page.goto('http://localhost:5173/uap')
            # Wait for canvas to load
            page.wait_for_selector('canvas', timeout=10000)
            # Take screenshot of initial state
            page.screenshot(path='verification/uap_tracker_initial.png')
            print('Initial screenshot taken')

            # Click Enable AR button
            page.get_by_role('button', name='Enable AR').click()
            # Wait a bit
            page.wait_for_timeout(1000)
            page.screenshot(path='verification/uap_tracker_ar_enabled.png')
            print('AR Enabled screenshot taken')

        except Exception as e:
            print(f'Error: {e}')
        finally:
            browser.close()

if __name__ == '__main__':
    verify_uap_tracker()
