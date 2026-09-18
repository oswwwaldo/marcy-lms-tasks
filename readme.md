# Marcy LMS Tasks

Uses the Google Tasks REST API to log assignments directly into your workflow from Marcy LMS.

### MVP Scope Defintion
* **Marcy LMS Authentication:** Fetch data and pass credentials, account for both unlogged and logged in states—prompt user
* **Google Tasks OAuth Setup:** Seamless login using `chrome.identity.getAuthToken` with the Google Tasks API scope (`[https://www.googleapis.com/auth/tasks](https://www.googleapis.com/auth/tasks)`).
* **Payload Normalization:** A parser function that extracts `id`, `title`, `dueDate`, `description`, and `courseName` from the raw tRPC assignment JSON payload.
* **Deduplication Engine:** A mapping stored in `chrome.storage.local` (`{ [lmsAssignmentId]: googleTaskId }`). This prevents creating 20 duplicate tasks every time a sync runs—if the ID exists, send a `PATCH`; if not, send a `POST`.
* **Minimal Popup UI:**
  * Auth button ("Connect Google Account" / "Connected").
  * Manual "Sync Now" trigger button.
  * Last synced timestamp (e.g., *"Last synced 12 minutes ago"*).
  * Privacy policy page, help & feedback and developer page
  * Pending feedback changes to read
* **Background Automation:** A `chrome.alarms` listener in `service-worker.js` that automatically runs the sync every 2 to 4 hours in the background.
* **Google Task List Selector:** Sync directly to the user's default `@default` list rather than letting them pick/create custom lists.
* **One way sync:** Checking off a task in Marcy LMS will mark it complete in Google Tasks.
* **Rich-Text Description Formatting:** Keep task notes in Google Tasks as clean plaintext containing the assignment link and assignment details.
