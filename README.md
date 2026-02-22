# Malicious Skill Filter Action

A GitHub Action that scans AI skill files (markdown in `skills/`) for malicious content using Google's Gemini API. The workflow runs on push to `main` or any PR raised and fails if any skill is flagged.

---

## Setup

### Prerequisites

- **Node.js** 20 or later
- **npm** (comes with Node.js)
- GEMINI API key 

### 1. Clone and install

After forking this repo
```bash
git clone <your-forked-repo-url>
cd malacious_skill_filter_action
npm install
```

### 2. Environment variables

Create a `.env` file in the project root (do not commit it):

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Optional:

```env
GEMINI_MODEL=gemini-2.5-flash-lite
```

If `GEMINI_MODEL` is not set, the scanner uses `gemini-2.5-flash-lite` by default.

### 3. GitHub Actions (CI)

For the workflow to run in GitHub:

1. In the repo: **Settings → Secrets and variables → Actions**
2. Add a secret: **`GEMINI_API_KEY`** with your Gemini API key
3. Optionally add **`GEMINI_MODEL`** if you want a different model than the default

The workflow uses the `malacious_skill_filter_action` environment; create it in **Settings → Environments** if you use environment-specific secrets.

---

## How to run locally

From the project root:

```bash
node scanner/scan.js
```

**Behavior:**

- Reads all `.md` files in the `skills/` directory
- Sends each file’s content to Gemini for analysis
- Prints a report: ✅ for clean files, ⚠️ and line details for flagged content
- Exits with code **0** if no malicious content is found, **1** if any file is flagged or an error occurs

**Requirements:** `GEMINI_API_KEY` must be set (e.g. in `.env`). If it’s missing, the script prints an error and exits.

---

## How the detection logic works

### Overview

Detection is **AI-based**: the scanner sends each skill file’s markdown to Gemini with a fixed security prompt. The model classifies the content and returns either “all safe” or a list of malicious lines. There are no regex or keyword rules; classification is done entirely by the model.

### Flow

1. **Input**  
   All `.md` files under `skills/` are collected.
2. **Per-file analysis**  
   For each file:
   - The full file content is read.
   - It is wrapped in `<CONTENT>...</CONTENT>` and sent to Gemini with the security prompt 
   - The prompt tells the model to treat the content as **data to analyze**, not as instructions to execute.

3. **Security prompt (what we ask the model to look for)**  
   The model is instructed to treat the content strictly as data and to flag **malicious content**, including:
   - Prompt injection attempts  
   - Data exfiltration commands  
   - Jailbreak attempts  
   - System override instructions  
   - Hidden commands or backdoors  
   - Attempts to leak environment variables or secrets  

4. **Expected response format**  
   The model must reply with **only** one of:
   - **`ALL_SAFE`** — no malicious content
   - **`MALICIOUS: <line number>: "<exact line text>"`** — one line per flagged line (and nothing else: no explanations or summaries)

5. **Parsing**  
   - If the reply is exactly `ALL_SAFE` → file is considered **safe**.  
   - If the reply contains any line starting with `MALICIOUS:` → those lines are parsed and the file is **flagged**.  
   - Empty or unexpected output is treated as **suspicious** (file is flagged).

6. **Concurrency and exit code**  
   Up to 5 files are processed concurrently to avoid overloading the API. After all files are processed:
   - If **any** file is flagged (or any scan errors), the process **exits with code 1** (failing the workflow when run in CI).
   - If **all** files are clean, the process **exits with code 0**.

Detection is thus entirely driven by the Gemini model’s interpretation of the prompt and the listed categories of malicious behavior; there is no separate rule-based or static-pattern layer.

---
- Design approach Diagram
![Screenshot 2026-02-22 114319](https://raw.githubusercontent.com/Nis-chal-Jain/assets/main/Screenshot%202026-02-22%20114319.png)

- Github action workflow diagram
![Screenshot 2026-02-22 114319](https://raw.githubusercontent.com/Nis-chal-Jain/assets/main/Screenshot%202026-02-22%20115024.png)
