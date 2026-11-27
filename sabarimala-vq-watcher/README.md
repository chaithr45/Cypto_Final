# Sabarimala Virtual-Q Watcher

A Tampermonkey script for your own logged-in Chrome tab on `sabarimalaonline.org/#/darshan`.

Every 40–45 seconds it refreshes the page and opens the calendar. If **4 Jan 2027** is green and has a **Pamba** slot starting at **16:00 or later**, or **5 Jan 2027** is green and has a Pamba slot starting **before 10:00**, it does the following:

1. picks that date and the Pamba route,
2. clicks the earliest matching slot that still has tickets,
3. chooses **Self**,
4. fills the nominee (name, age, relation),
5. sets both contributions to **No**,
6. clicks **Add to Wishlist**, then stops and alerts you (Windows notification, beeps, flashing tab title).

It does **not** finish the booking from the wishlist. Do that yourself as soon as the alert appears.

## Install (Chrome on Windows)

1. Install **Tampermonkey** from the Chrome Web Store.
2. Open `chrome://extensions`, click **Details** under Tampermonkey and turn on **Allow User Scripts**. On older Chrome versions, turn on **Developer mode** (top right) instead.
3. Click the Tampermonkey icon, then **Create a new script…**. Delete the template, paste all of `sabarimala-vq-watcher.user.js`, and press **Ctrl+S**.

## Use

1. Log in on sabarimalaonline.org and open **Virtual-Q**. A **VQ Watcher** panel appears at the bottom-left.
2. In the panel, check the nominee name and age and type the **relation** exactly as it appears in the site's "Select Relation" list (for example `Father`).
3. Press **Test (no submit)**. It runs every step on any date that is green right now but does **not** click Add to Wishlist. When you see `TEST PASSED`, press **Reset** on the page.
4. Press **Start** and leave the tab alone.

Keep it running reliably:

- Keep the tab in its **own window, not minimised**. Chrome slows down background tabs.
- Under Chrome **Settings → Performance**, add `sabarimalaonline.org` to **Always keep these sites active**.
- Keep the laptop plugged in with sleep turned off.
- Run it in **one tab only**.

If the site logs you out, the panel says so and alerts you. Log in again and open Virtual-Q, and it carries on by itself.

## Change the targets

Edit the `CONFIG` block at the top of the script: dates, time windows, route, refresh interval and contributions.
