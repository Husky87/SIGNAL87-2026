# Google OAuth Verification — submission content

Paste-ready text for the Google Auth Platform → Verification Center fields, plus the
console changes that have to be made by hand. Code-side fixes are already committed.

---

## 1. Scopes: delete four, keep one

The consent screen currently requests five scopes. Four of them the code never used:

| Scope | Status | Why |
| --- | --- | --- |
| `auth/drive` | **Remove** | Full read/write/delete. Nothing in the app writes to Drive. |
| `auth/spreadsheets` | **Remove** | The Sheets API was never called. Dead code, now deleted. |
| `auth/spreadsheets.readonly` | **Remove** | Same as above. |
| `auth/drive.file` | **Remove** | Not needed alongside `drive.readonly` for read-only browsing. |
| `auth/drive.readonly` | **Keep** | The only scope the app actually uses. |

`auth/drive` and `auth/spreadsheets` were being added to the shared sign-in provider at
module load, so *every* plain "Sign in with Google" asked for full Drive read/write/delete
and full Sheets access. That is now fixed: sign-in requests identity only, and
`drive.readonly` is requested separately when the user explicitly connects Drive.

In **Data Access**, remove the four scopes above so only `drive.readonly` remains. That
clears four of the five warning rows on its own.

> **Read this before submitting:** `drive.readonly` is still a **restricted** scope.
> Restricted scopes require verification *and* an annual third-party CASA security
> assessment, which is slow and paid. See section 5 for the alternative that avoids
> restricted-scope review entirely.

---

## 2. Scope justification — `.../auth/drive.readonly`

> Signal87 AI is a document analysis platform. Users import documents they already store in
> Google Drive so the application can extract the text and answer questions about those
> documents with citations back to the source.
>
> `drive.readonly` is used for exactly two operations:
>
> 1. `files.list` — renders an in-app file browser so the user can find and choose which of
>    their own documents to import. The listing requests only the id, name, mimeType, size,
>    modifiedTime, and link fields.
> 2. `files.get?alt=media` and `files.export` — downloads the content of only the specific
>    files the user selects, so the text can be extracted and indexed for search.
>
> The application never creates, modifies, or deletes anything in the user's Drive, which is
> why no write scope is requested. Read access to the file listing is required because the
> user chooses their source documents from their existing Drive contents.

---

## 3. Intended data usage

> File content is downloaded only for the documents a user explicitly selects. The extracted
> text is stored in that user's own private workspace in Firestore, readable only by their
> authenticated account, and is used solely to answer that user's questions about their own
> documents.
>
> Document text is sent to Google Gemini and OpenAI only to generate the summary or answer the
> user requested. It is not used to train any model, is not sold, is not shared with
> advertisers, and is not disclosed to any third party beyond those processing sub-processors.
> Users can delete imported documents and their extracted text at any time. Drive access
> tokens are held in memory for the active session only and are never persisted.

---

## 4. Appeal explanations (both under the 1000-character limit)

### "Your home page does not explain the purpose of your app."

> The home page has been updated to state the application's purpose directly. The page title
> is now "Signal87 AI — Enterprise Document Memory & Legal AI Research Platform", and the meta
> description and hero section explain that Signal87 AI lets users upload contracts, reports,
> and spreadsheets and ask questions in plain language, returning answers with citations to the
> exact page and paragraph in their own documents. A no-JavaScript fallback carrying the same
> description and links to the Privacy Policy and Terms of Service was added so the purpose is
> visible in the raw HTML without executing scripts. The home page footer links to
> https://signal87.ai/privacy and https://signal87.ai/terms.

### "The app name 'Signal87 AI' ... does not match the app name on your home page."

> The mismatch was caused by the home page title, which previously read "Michael Benezra |
> Signal87 AI — CEO & Co-Founder" and led with the founder's name rather than the application
> name. The title now reads "Signal87 AI — Enterprise Document Memory & Legal AI Research
> Platform", and the application is identified as "Signal87 AI" consistently across the page
> title, header navigation, Open Graph and Twitter metadata, and SoftwareApplication structured
> data. This matches the app name configured on the OAuth consent screen exactly.

---

## 5. The restricted-scope decision

Two paths, and this is worth deciding before spending a verification cycle:

**A. Ship `drive.readonly` (current code).** Keeps the in-app Drive browser exactly as built.
Cost: restricted-scope verification, demo video, and a CASA security assessment renewed
annually.

**B. Switch to Google Picker + `drive.file`.** `drive.file` is **non-sensitive** — it needs no
verification, no demo video, and no CASA assessment. The user picks files through Google's own
Picker dialog and the app receives access to only those files. Cost: the custom Drive browser
in `fetchDriveFiles` gets replaced by the Picker, so the file-list UI changes.

Option B is dramatically less ongoing work and cost. It requires a real code change, so it
hasn't been made unilaterally.

---

## 6. Demo video (required for restricted scopes — path A only)

Unlisted YouTube is fine. It must show, in one continuous recording:

1. The browser URL bar showing the production URL, to establish it's the app under review.
2. The OAuth consent screen, readable, showing the app name "Signal87 AI" and the
   `drive.readonly` grant. Do not cut away during consent.
3. The Drive file browser listing files — this demonstrates `files.list`.
4. Selecting one document and importing it — this demonstrates the download/export call.
5. Asking a question about that document and receiving an answer with a citation. This is the
   part that shows *why* the scope is needed rather than just that it's requested.

---

## 7. Console checklist

- [ ] **Data Access** — remove the four scopes in section 1; only `drive.readonly` remains
- [ ] **Data Access** — paste sections 2 and 3 into scope justification / intended data usage
- [ ] **Branding** — app name exactly `Signal87 AI`
- [ ] **Branding** — home page `https://signal87.ai/`
- [ ] **Branding** — privacy `https://signal87.ai/privacy`
- [ ] **Branding** — terms `https://signal87.ai/terms`
- [ ] **Branding** — authorized domains trimmed to 10 or fewer
- [ ] Demo video recorded and linked (path A only)
- [ ] **Confirm the deploy first** — `/privacy` and `/terms` must return 200 on the live domain
      before submitting, or the policy-URL check fails again
