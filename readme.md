# Marcy LMS Tasks

Uses the Google Tasks REST API to log assignments directly into your workflow from Marcy LMS.

Handle Marcy LMS authentication, prompt user to sign in
Fetch assignments.listMine
Handle Google authentication
Call Google Tasks API and pass along data
Synchroinze live-time

Google Tasks OAuthSetup
Payload normalization

---

## MVP Scope Definition

### 1. The Core "Must-Have" Features

* **Google Tasks OAuth Setup:** Seamless login using `chrome.identity.getAuthToken` with the Google Tasks API scope (`[https://www.googleapis.com/auth/tasks](https://www.googleapis.com/auth/tasks)`).
* **Payload Normalization:** A parser function that extracts `id`, `title`, `dueDate`, `description`, and `courseName` from the raw tRPC assignment JSON payload.
* **Deduplication Engine:** A mapping stored in `chrome.storage.local` (`{ [lmsAssignmentId]: googleTaskId }`). This prevents creating 20 duplicate tasks every time a sync runs—if the ID exists, send a `PATCH`; if not, send a `POST`.
* **Minimal Popup UI:**
* Auth button ("Connect Google Account" / "Connected").
* Manual "Sync Now" trigger button.
* Last synced timestamp (e.g., *"Last synced 12 minutes ago"*).


* **Background Automation:** A `chrome.alarms` listener in `service-worker.js` that automatically runs the sync every 2 to 4 hours in the background.

---

### 2. The "Cut Line" (Do NOT Build These for MVP)

To finish in 5 days, strictly cut the following features for V1.0:

* ❌ **Bi-directional Sync:** Checking off a task in Google Tasks will *not* mark it complete in Marcy LMS.
* ❌ **Custom Google Task List Selector:** Sync directly to the user's default `@default` list rather than letting them pick/create custom lists.
* ❌ **Complex Notification System:** Skip desktop popups for every individual synced task.
* ❌ **Rich-Text Description Formatting:** Keep task notes in Google Tasks as clean plaintext containing the assignment link and course name.

---

## 5-Day Execution Roadmap

```
[Day 1: Google OAuth] ──► [Day 2: Deduplication Engine] ──► [Day 3: Google API Sync]
                                                                     │
[Day 5: Alarms & Testing] ◄────────────── [Day 4: Popup UI] ─────────┘

```

### Day 1: Google OAuth2 & API Setup

* Create a project in the Google Cloud Console and enable the **Google Tasks API**.
* Add the `"oauth2"` block to `manifest.json` with your Client ID and scope (`[https://www.googleapis.com/auth/tasks](https://www.googleapis.com/auth/tasks)`).
* Verify that calling `chrome.identity.getAuthToken({ interactive: true })` inside `service-worker.js` successfully logs a valid OAuth access token.

### Day 2: Data Normalization & Local Storage

* Write a clean utility method to transform the raw tRPC assignments payload into standardized Google Task objects:
```json
{
  "title": "[CS101] Binary Tree Implementation",
  "notes": "Due link: https://mls-lms.vercel.app/assignments/...",
  "due": "2026-09-25T23:59:00.000Z"
}

```

* Implement the local lookup table in `chrome.storage.local` to track existing `lmsAssignmentId` to `googleTaskId` mappings.

### Day 3: Google Tasks REST Integration

* Write the `createOrUpdateGoogleTask()` function using standard `fetch()` calls to the Google Tasks REST API (`[https://tasks.googleapis.com/tasks/v1/lists/@default/tasks](https://tasks.googleapis.com/tasks/v1/lists/@default/tasks)`).
* Test sending a test payload from your service worker and verify that tasks appear live on [tasks.google.com](https://tasks.google.com).

### Day 4: Popup UI

* Build a simple `marcy-lms-tasks.html` popup interface:
* Show connection status to Google Tasks.
* Add a primary **"Sync Now"** button that communicates with `service-worker.js`.
* Display a simple loading spinner during active syncs.



### Day 5: Background Scheduler & Edge-Case Testing

* Register a `chrome.alarms` periodic check (e.g., every 120 minutes) in `service-worker.js` to handle silent background updates.
* Test edge cases: What happens when the user is logged out of LMS? What happens if Google token expires?
* Wrap up V1.0!