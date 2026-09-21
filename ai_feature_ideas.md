# AI Feature Ideas for Marcy LMS Tasks

Based on your extension's current architecture — fetching assignments from Marcy LMS tRPC endpoints, syncing them to Google Tasks via REST API, managing dual auth state, and running background sync via service workers — here are 5 ideas ranked from most practical to most ambitious.

---

## 1. 🧠 AI Assignment Summarizer ("Study Brief")

### What it does
When assignments sync from Marcy LMS, an LLM reads the assignment title, description, course name, and due date, then generates a **1–2 sentence actionable summary** displayed in the popup. Think of it like a daily briefing:

> *"You have 3 assignments due this week. Priority: **Binary Tree Implementation** (CS101, due tomorrow). The two others are low-stakes reading responses due Friday."*

### Why this is a strong pick
- It's a **human-in-the-loop** feature — the AI generates the summary, but the user decides what to act on
- It directly enhances your existing data flow (you already have the assignment payload)
- It's visible and impressive in a demo — non-technical people instantly understand the value

### Difficulty: ⭐⭐ (Moderate)
- The LLM call itself is straightforward (one API call)
- The challenge is **prompt engineering** — getting consistently useful summaries from messy/short assignment titles
- You'll need to handle the API key securely (Cloudflare Worker, similar to your existing OAuth worker)

### Technologies
| Technology | Role |
|---|---|
| **OpenAI API** (`gpt-4o-mini`) | Generate the summary — cheap (~$0.01 per 100 summaries) |
| **Cloudflare Worker** | Proxy the API call so your API key never touches the extension |
| **chrome.storage.local** | Cache summaries so you don't re-generate on every popup open |

### How it fits your codebase
```
fetchMarcyAPI('assignments') → normalize payload → send to Cloudflare Worker
    → Worker calls OpenAI → returns summary → display in popup
```

You'd add a new message action in [service-worker.js](file:///c:/Users/ofdls/Desktop/dev/marcy-lms-tasks/service-worker.js) like `generate_summary`, and a new section in [popup.js](file:///c:/Users/ofdls/Desktop/dev/marcy-lms-tasks/popup.js) to render it.

---

## 2. 📊 Smart Priority Scoring

### What it does
Instead of displaying assignments in whatever order the API returns, an LLM **scores and ranks** them by urgency. Each task gets a priority tag (`🔴 Urgent`, `🟡 Soon`, `🟢 Flexible`) based on:
- Days until due date
- Assignment type (project vs. reading vs. quiz)
- Course workload (if 3 assignments are due in one course, flag it)

### Why this is a strong pick
- Demonstrates **structured output** from an LLM (JSON mode) — a key skill in AI engineering
- The scoring logic can start rule-based and layer in AI later, so you learn incrementally
- Feeds directly into your Google Tasks sync — you could set task priority levels via the API

### Difficulty: ⭐⭐ (Moderate)
- Similar API complexity to Idea #1
- The new skill here is **JSON mode / structured output** — telling the LLM to respond in a specific schema
- Edge case: what if the LLM returns malformed JSON? You'll learn defensive parsing

### Technologies
| Technology | Role |
|---|---|
| **OpenAI API** (with `response_format: { type: "json_object" }`) | Score assignments and return structured priority data |
| **Cloudflare Worker** | Proxy, same as above |
| **Google Tasks API** | Optionally set task priority/order based on scores |

### How it fits your codebase
Similar to #1 — you'd process the assignment payload through the LLM before syncing to Google Tasks. The priority data could be stored alongside your deduplication map in `chrome.storage.local`.

---

## 3. 💬 Conversational Task Assistant (LangChain)

### What it does
Add a small chat input in the popup where the user can ask natural language questions about their assignments:
- *"What's due this week?"*
- *"Do I have anything for CS101?"*
- *"What should I work on tonight?"*

The AI has **context** about all their synced assignments and responds conversationally.

### Why this is a strong pick
- This is the **LangChain** use case — you'd use it to manage the conversation chain and inject assignment context
- It's the most "wow factor" feature for a demo
- It's a genuine human-in-the-loop interaction

### Difficulty: ⭐⭐⭐ (Hard)
- **LangChain.js** has a learning curve — chains, prompts, memory, output parsers
- You need to manage **conversation memory** (even if just for the popup session)
- Prompt injection is a real concern (what if someone pastes weird assignment titles?)
- The popup closes when you click away, so you'd need to handle session persistence

### Technologies
| Technology | Role |
|---|---|
| **LangChain.js** | Orchestrate the conversation chain, manage prompt templates and memory |
| **OpenAI API** (`gpt-4o-mini`) | The underlying LLM |
| **Cloudflare Worker** | Proxy API calls |
| **chrome.storage.session** | Persist chat history for the popup session |

### How it fits your codebase
You'd add a chat UI section to [popup.html](file:///c:/Users/ofdls/Desktop/dev/marcy-lms-tasks/popup.html), a new handler in [popup.js](file:///c:/Users/ofdls/Desktop/dev/marcy-lms-tasks/popup.js), and the LangChain logic could live either in popup.js or in the service worker (if you want the conversation to persist across popup opens).

---

## 4. 📝 Auto-Generated Task Descriptions with RAG

### What it does
When syncing an assignment to Google Tasks, the extension **enriches the task description** with helpful context pulled from the LMS. Instead of a bare title like "Binary Tree Implementation", the Google Task would contain:

> **Binary Tree Implementation** — CS101  
> *Due: Sep 25 · Estimated time: 2–3 hours*  
> Key topics: BST traversal, recursion, time complexity  
> Related resources: Chapter 8 of textbook  

The AI generates this by combining the assignment metadata with any course/description data available from the LMS API.

### Why this is a strong pick
- Introduces **RAG (Retrieval-Augmented Generation)** — a flagship AI pattern you'll see everywhere
- The "retrieval" part is your existing `fetchMarcyAPI` endpoints (courses, assignments)
- The "generation" part is the LLM enriching sparse data into useful descriptions

### Difficulty: ⭐⭐⭐ (Hard)
- RAG as a concept is straightforward, but implementing it cleanly takes practice
- You need to **fetch from multiple endpoints** (assignments + courses) and combine them into a coherent prompt
- Token management — you don't want to send the entire course catalog to the LLM every time

### Technologies
| Technology | Role |
|---|---|
| **LangChain.js** | RAG pipeline — retrieval step + generation step |
| **OpenAI API** | Generate enriched descriptions |
| **Cloudflare Worker** | Proxy |
| **Google Tasks API** | Write enriched descriptions to the `notes` field of tasks |

### How it fits your codebase
This would slot into your sync flow in [service-worker.js](file:///c:/Users/ofdls/Desktop/dev/marcy-lms-tasks/service-worker.js). Before calling `createOrUpdateGoogleTask()`, you'd run the assignment through the RAG pipeline to generate a rich description.

---

## 5. 🔔 Predictive "You're Falling Behind" Alerts

### What it does
The extension tracks assignment completion patterns over time — when you complete tasks, how close to deadlines you typically finish, which courses pile up. An LLM analyzes this history and sends **proactive Chrome notifications**:

> *"Heads up: you have 4 assignments due in the next 3 days, but your average completion rate this week is 1/day. Consider starting the CS101 project tonight."*

### Why this is a strong pick
- Uses your existing `chrome.alarms` + `chrome.notifications` infrastructure
- Demonstrates **temporal reasoning** — the AI reasons about patterns over time
- Genuinely useful for students, not just a gimmick

### Difficulty: ⭐⭐⭐⭐ (Very Hard)
- Requires **historical data tracking** — you need to store completion timestamps over weeks
- The prompt engineering is complex — the AI needs to reason about rates, trends, and deadlines simultaneously
- Privacy considerations — you're storing behavioral data locally
- Hard to test quickly (you need real data accumulated over days/weeks)

### Technologies
| Technology | Role |
|---|---|
| **OpenAI API** | Analyze patterns and generate personalized alerts |
| **chrome.storage.local** | Store historical completion data |
| **chrome.alarms** | Trigger periodic analysis (you already use this) |
| **chrome.notifications** | Push the alert to the user |
| **LangChain.js** (optional) | Memory/chain management for multi-step analysis |

### How it fits your codebase
This would live entirely in [service-worker.js](file:///c:/Users/ofdls/Desktop/dev/marcy-lms-tasks/service-worker.js) as a background job. Your existing alarm-based sync would be extended to also run the AI analysis.

---

## Recommendation

> [!TIP]
> **Start with Idea #1 (AI Assignment Summarizer).** It's the fastest to build, uses a tech stack you're already comfortable with (Cloudflare Workers + fetch), and gives you the most visible result. Once that works, you'll have the foundation (API key management, prompt engineering, caching) to build any of the others on top of it.

| Idea | Difficulty | New Tech You'd Learn | Time Estimate |
|---|---|---|---|
| 1. AI Summarizer | ⭐⭐ | OpenAI API, prompt engineering | 1–2 days |
| 2. Priority Scoring | ⭐⭐ | Structured JSON output from LLMs | 1–2 days |
| 3. Chat Assistant | ⭐⭐⭐ | LangChain.js, conversation memory | 3–4 days |
| 4. RAG Descriptions | ⭐⭐⭐ | RAG pattern, multi-source retrieval | 3–4 days |
| 5. Predictive Alerts | ⭐⭐⭐⭐ | Temporal reasoning, behavioral tracking | 5+ days |

Which of these interests you? I can help you build it.
