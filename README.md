# Referral Assistant

A Chrome side panel that helps you find people at a target company, write referral
requests and track follow-ups. It never sends anything — you send every message yourself.
By default it never reads LinkedIn either; an optional, read-only acceptance check (off
until you turn it on in Settings) can read your open Connections page to spot who accepted.

## Install

1. Unzip this project into a folder you will keep.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the `dist` folder.
4. Pin Referral Assistant and click its icon.

## Use

1. **Settings:** enter your name, skills and school.
2. **Find:** type "I am applying for Software Engineer at WEX", or paste a job description.
   You can also select text on a page, right-click and choose **Find referrals for this job**.
3. Check the detected fields, then open the searches.
4. Copy a person's name, title and profile link into **Add someone you found**.
5. For a saved person, click **Connect**: it copies the connection note, opens their profile, and
   marks them invited. Paste the note, review it, and press **Send** on LinkedIn yourself.
   The Contacts tab shows your invites this week against a weekly cap (set in Settings, default 80)
   so you do not over-send; the button disables once the cap is reached.
6. Or click **Write message** to edit the note first, then copy and send it yourself on LinkedIn.
   Marking someone invited starts a reminder that appears after 5 days (configurable), at most
   twice per person. Change the status when they accept or reply.
7. When someone accepts, set their status to **Connected**. The extension drafts a referral
   message and puts it in the **Outbox**. Review it there, copy it, send it on LinkedIn yourself,
   then click **I sent it** — which starts the follow-up clock as usual.

## Acceptance check (optional, read-only)

Setting each contact to **Connected** by hand is the default. If you prefer, turn on
**Acceptance check** in Settings (it asks for permission to access linkedin.com). The Outbox
then shows a **Check LinkedIn for acceptances** button: open your LinkedIn Connections page,
click it, and it reads that page once to find which of your pending invites were accepted and
drafts their messages. It only reads the open page on your click — it never polls, clicks or
sends, so you always send each message yourself.

## AI messages (optional)

Templates work without a key. For AI, choose a provider in Settings and paste a key from
https://aistudio.google.com/apikey or https://platform.openai.com/api-keys.

The key is stored unencrypted in your Chrome profile, so set a spending limit on it.
Model names are editable.

## How it is built

| File | Purpose |
| --- | --- |
| `public/manifest.json` | Manifest V3 and permissions |
| `src/background.ts` | Right-click menu, badge, reminders |
| `src/lib/detect.ts` | Company, role and location detection |
| `src/lib/links.ts` | LinkedIn search links |
| `src/lib/rank.ts` | Categories and relevance score |
| `src/lib/message.ts` | Templates and AI prompt |
| `src/lib/ai.ts` | Gemini and OpenAI calls |
| `src/lib/queue.ts` | Outbox drafting and acceptance matching |
| `src/lib/store.ts` | Chrome storage and version migration |
| `src/content/linkedin-read.ts` | Read-only profile scraper (acceptance check) |
| `src/ui/` | React side panel (incl. `Outbox.tsx`) |

## Develop

Needs Node 22.18 or newer.

    npm ci
    npm test
    npm run build

Then press reload on the extension's card in `chrome://extensions`.

## Limits

- Detection uses simple rules, so check the fields.
- LinkedIn keyword searches also match former employees.
- Connection note limits vary by account. The default here is 200 characters.
- Data stays in one Chrome profile. Use Export to back it up before removing the extension.
- Publishing a build that calls AI to other people needs a backend, so keys are not handled in
  the browser, plus a privacy policy, Chrome Web Store review and a name without LinkedIn's trademark.
