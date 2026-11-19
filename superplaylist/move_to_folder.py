#!/usr/bin/env python3
"""
File a playlist into a Spotify folder.

The Web API has no concept of folders, so this is the one part of the job that
genuinely needs a browser. It walks the same three-step menu a person would:
  More options -> Move to folder -> <folder name>

Addressed by role and accessible name, never by pixel coordinates. The
coordinate approach is what caused misfired clicks and accidental playback
when this ran in chat.

    python move_to_folder.py <playlist_id> [--folder "SUPERPLAYLIST!"]
"""

import argparse
import re
import sys

from browser import session

DEFAULT_FOLDER = "SUPERPLAYLIST!"


def move(playlist_id, folder=DEFAULT_FOLDER, headless=True, timeout=20000):
    """Returns True if filed. Never raises — the caller treats this as cosmetic."""
    try:
        with session(headless=headless) as ctx:
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            page.set_default_timeout(timeout)

            page.goto(f"https://open.spotify.com/playlist/{playlist_id}",
                      wait_until="domcontentloaded")

            # Confirm we're logged in before blaming the menu for anything.
            page.wait_for_timeout(2500)
            if page.locator('[data-testid="login-button"]').count():
                print("  not signed into Spotify — run `python browser.py --login`",
                      file=sys.stderr)
                return False

            # The button's accessible name carries the playlist title, so
            # match loosely rather than pinning the exact name.
            more = page.get_by_role(
                "button", name=re.compile(r"more options for", re.I)).first
            more.wait_for(state="visible")
            more.click()

            page.get_by_role("menuitem", name=re.compile(r"^Move to folder",
                                                         re.I)).click()

            # Submenu renders as a second menu; the folder is an exact name.
            page.get_by_role("menuitem", name=folder, exact=True).click()

            page.wait_for_timeout(2500)
            print(f"  filed into {folder}")
            return True

    except Exception as e:
        # Spotify's DOM moves around. A failure here must never fail a run
        # that already produced a correct playlist.
        print(f"  couldn't file it automatically ({type(e).__name__}: {e})",
              file=sys.stderr)
        print(f"  drag it into {folder} by hand:", file=sys.stderr)
        print(f"  https://open.spotify.com/playlist/{playlist_id}",
              file=sys.stderr)
        return False


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("playlist_id")
    ap.add_argument("--folder", default=DEFAULT_FOLDER)
    ap.add_argument("--headed", action="store_true",
                    help="watch it work — use this the first time")
    a = ap.parse_args()
    ok = move(a.playlist_id, a.folder, headless=not a.headed)
    sys.exit(0 if ok else 1)
