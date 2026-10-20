# Play Console Data Safety answers — Mess Monster

Fill these on the app’s **App content → Data safety** page. They match the free internal-test build.

If Google’s wording is a little different, keep the meaning: **your progress stays on the phone. We do not collect it.**

---

## Overview questions

**Does your app collect or share any of the required user data types?**
No.

**Is all of the user data collected by your app encrypted in transit?**
Not asked if you answered No. If Google still shows it, choose “Not applicable” / skip — we are not sending user data.

**Which of the following methods of account creation does your app support?**
None. The app does not let people create an account.

---

## Why this is “No”

| Thing people might worry about | What the app actually does |
| --- | --- |
| Chores, points, monster name | Saved only on the phone. Never uploaded. |
| Optional chore photos | Stay on the phone. Never uploaded. |
| Optional reminders | Scheduled on the phone. No push token, no server. |
| Founding Member | Button says Coming soon. No payment. |
| Crash reports | Off unless a Sentry key is added later. This test build has no key. |

Camera and notification **permissions** can still appear in the store. That is “may the phone use this,” not “we collect this.”

---

## If Google later forces a data type

Only if a future build starts sending crashes or taking real money, come back and add:

- **App activity / crash logs** — only if Sentry is turned on. Purpose: analytics / app functionality. Shared with Sentry. Not sold. Optional.
- **Purchases** — only after real Play billing exists. Handled by Google. Purpose: app functionality.

Until then, leave Data Safety as **does not collect**.

---

## Data deletion

Play may ask how people can delete their data.

Answer: **Uninstall the app.** There is no cloud account to email about.
