#!/usr/bin/env python3
"""
Shared browser session.

Everything browser-driven here (filing the playlist into a folder, the ROSTR
lookups) runs against ONE persistent Chromium profile living in .browser/.
You log into Spotify and ROSTR by hand once:

    python browser.py --login

...and both sessions stick around for every future run. No cookies are copied
out of your real Chrome, and no passwords are ever handled by this code.

Run `python -m playwright install chromium` after pip install.
"""

import argparse
import os

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
PROFILE = os.path.join(HERE, ".browser")


def context(headless=True, slow_mo=0):
    """Persistent-profile browser context. Caller closes it (or use `session`)."""
    pw = sync_playwright().start()
    ctx = pw.chromium.launch_persistent_context(
        PROFILE,
        headless=headless,
        slow_mo=slow_mo,
        viewport={"width": 1440, "height": 900},
        args=["--disable-blink-features=AutomationControlled"],
    )
    ctx._pw = pw  # so session() can stop it
    return ctx


class session:
    """`with session() as ctx:` — closes the context and the driver."""

    def __init__(self, headless=True, slow_mo=0):
        self.headless, self.slow_mo = headless, slow_mo

    def __enter__(self):
        self.ctx = context(self.headless, self.slow_mo)
        return self.ctx

    def __exit__(self, *exc):
        try:
            self.ctx.close()
        finally:
            self.ctx._pw.stop()


def login():
    """Open a headed window so you can sign in to both sites once."""
    print(f"Profile: {PROFILE}")
    print("Log into Spotify and ROSTR in the window that opens, then close it.")
    with session(headless=False) as ctx:
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto("https://open.spotify.com")
        page.wait_for_timeout(1000)
        ctx.new_page().goto("https://www.rostr.cc")
        print("\nWaiting — close the browser window when you're signed in.")
        try:
            page.wait_for_event("close", timeout=0)
        except Exception:
            pass
    print("Saved. Future runs use this profile headlessly.")


def check():
    """Report whether each session is still alive."""
    with session(headless=True) as ctx:
        page = ctx.new_page()

        page.goto("https://open.spotify.com", wait_until="domcontentloaded")
        page.wait_for_timeout(3000)
        spotify = page.locator('[data-testid="user-widget-link"], '
                               '[data-testid="user-widget-avatar"]').count() > 0

        page.goto("https://www.rostr.cc", wait_until="domcontentloaded")
        page.wait_for_timeout(2000)
        rostr = page.evaluate("""async () => {
            const r = await fetch(
                'https://api.rostr.cc/v1/artist/lucydacus/team/AGENCY',
                {credentials: 'include'});
            return r.status;
        }""") == 200

    print(f"Spotify: {'signed in' if spotify else 'SIGNED OUT'}")
    print(f"ROSTR:   {'signed in' if rostr else 'SIGNED OUT'}")
    if not (spotify and rostr):
        print("\nRun `python browser.py --login` to fix.")
    return spotify and rostr


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--login", action="store_true")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    if a.login:
        login()
    elif a.check:
        check()
    else:
        ap.print_help()
