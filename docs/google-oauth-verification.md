# Google OAuth Verification — submission content

Paste-ready text for the Google Auth Platform → Verification Center fields, plus the
console changes that have to be made by hand. Code-side fixes are already committed.

---

## 1. Scopes: delete all five, add `drive.file`

The app now uses **`.../auth/drive.file`** and nothing else beyond basic sign-in.
`drive.file` is **non-sensitive**, which means no restricted-scope review, no demo
video, and no annual CASA security assessment.

| Scope | Action | Why |
| --- | --- | --- |
| `auth/drive` | **Remove** | Full read/write/delete. Nothing in the app writes to Drive. |
| `auth/drive.readonly` | **Remove** | Restricted. Only needed to list a whole Drive; the Picker replaced that. |
| `auth/spreadsheets` | **Remove** | The Sheets API was never called. Dead code, now deleted. |
| `auth/spreadsheets.readonly` | **Remove** | Same as above. |
| `auth/drive.file` | **Keep / add** | Per-file access, granted only for files the user picks. |

Two things were wrong before. `auth/drive` and `auth/spreadsheets` were added to the
shared sign-in provider at module load, so *every* plain "Sign in with Google" asked
for full Drive read/write/delete plus full Sheets access. And file discovery used
`files.list`, which can only work with the restricted `drive.readonly` scope.

Both are fixed: sign-in requests identity only, and file discovery now goes through
Google's own Picker, which grants access per picked file under `drive.file`.

Once the four scopes above are removed in **Data Access**, the "scope justification /
intended data usage / demo video" errors should clear on their own — those fields are
only demanded for sensitive and restricted scopes.

---

## 2. Scope justification — `.../auth/drive.file`

Fill this in if the console still asks. It generally does not for non-sensitive scopes.

> Signal87 AI is a document analysis platform. Users import documents they already
> store in Google Drive so the application can extract the text and answer questions
> about them with citations back to the source.
>
> File selection happens entirely in the Google Picker. The application never lists or
> searches the user's Drive; it receives access only to the specific files the user
> chooses in the Picker. For each of those files it calls `files.get?alt=media` (or
> `files.export` for native Google Docs, Sheets, and Slides) once, to read the content
> for text extraction.
>
> The application never creates, modifies, or deletes anything in the user's Drive.

---

## 3. Intended data usage

> File content is downloaded only for the documents a user explicitly picks. The
> extracted text is stored in that user's own private workspace in Firestore, readable
> only by their authenticated account, and is used solely to answer that user's
> questions about their own documents.
>
> Document text is sent to Google Gemini and OpenAI only to generate the summary or
> answer the user requested. It is not used to train any model, is not sold, is not
> shared with advertisers, and is not disclosed to any third party beyond those
> processing sub-processors. Users can delete imported documents and their extracted
> text at any time. Drive access tokens are held in memory for the active session only,
> are never persisted, and are discarded on sign-out.

---

## 4. Appeal explanations (both under the 1000-character limit)

### "Your home page does not explain the purpose of your app."

> The home page has been updated to state the application's purpose directly. The page
> title is now "Signal87 AI — Enterprise Document Memory & Legal AI Research Platform",
> and the meta description and hero section explain that Signal87 AI lets users upload
> contracts, reports, and spreadsheets and ask questions in plain language, returning
> answers with citations to the exact page and paragraph in their own documents. A
> no-JavaScript fallback carrying the same description and links to the Privacy Policy
> and Terms of Service was added so the purpose is visible in the raw HTML without
> executing scripts. The home page footer links to https://signal87.ai/privacy and
> https://signal87.ai/terms.

### "The app name 'Signal87 AI' ... does not match the app name on your home page."

> The mismatch was caused by the home page title, which previously read "Michael
> Benezra | Signal87 AI — CEO & Co-Founder" and led with the founder's name rather than
> the application name. The title now reads "Signal87 AI — Enterprise Document Memory &
> Legal AI Research Platform", and the application is identified as "Signal87 AI"
> consistently across the page title, header navigation, Open Graph and Twitter
> metadata, and SoftwareApplication structured data. This matches the app name
> configured on the OAuth consent screen exactly.

---

## 5. Enable the Picker API

The Picker needs one API turned on and one key reachable. Both are console-side:

- **APIs & Services → Library → Google Picker API → Enable.** Without this the picker
  fails to open.
- The Picker uses the browser API key already in `firebase-applet-config.json`
  (`apiKey`). If that key has **API restrictions** set, add *Google Picker API* to its
  allowed list, and keep *Google Drive API* enabled too. If it has HTTP referrer
  restrictions, they must cover the production domain.
- No new environment variables are needed. The code reads the client ID, API key, and
  project number (`messagingSenderId`, used as the Picker `appId`) from the existing
  Firebase config file.

---

## 6. Console checklist

- [ ] **Data Access** — remove the four scopes in section 1; add `.../auth/drive.file`
- [ ] **APIs & Services** — enable the Google Picker API (section 5)
- [ ] **Branding** — app name exactly `Signal87 AI`
- [ ] **Branding** — home page `https://signal87.ai/`
- [ ] **Branding** — privacy `https://signal87.ai/privacy`
- [ ] **Branding** — terms `https://signal87.ai/terms`
- [ ] **Branding** — authorized domains trimmed to 10 or fewer
- [ ] **Confirm the deploy first** — `/privacy` and `/terms` must return 200 on the live
      domain before submitting, or the policy-URL check fails again
- [ ] Test the Drive import end to end in production once the Picker API is on — this
      flow could not be exercised from the build environment

---

## 7. What changed in the code

- `index.html` — title, meta description, OG/Twitter tags, and structured data now lead
  with "Signal87 AI" and describe the product. Added a `<noscript>` block carrying the
  purpose and policy links, since the app renders client-side and the raw HTML was
  otherwise an empty root div.
- `src/lib/firebase.ts` — dropped the `addScope` calls; sign-in requests identity only.
- `src/lib/googleDriveService.ts` — replaced `authenticateGoogleDrive` + `fetchDriveFiles`
  with `pickFilesFromDrive`, built on Google Identity Services (incremental `drive.file`
  token) and the Google Picker. `importFileFromDrive` now clears the cached token on
  401/403.
- `src/components/GoogleDrivePickerModal.tsx` — the custom file browser, search, and
  category filters are gone; the modal now stages the files returned by the Picker.
- `src/lib/googleSheetsService.ts` — deleted; it was never imported.
- `src/App.tsx` — sign-out clears the in-memory Drive token, which previously survived
  logout and would have been inherited by the next account signing in on the same tab.
