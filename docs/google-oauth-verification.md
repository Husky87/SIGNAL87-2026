# Publishing the app to Google (no verification review needed)

Signal87 AI no longer asks Google for anything beyond a user's name, email, and profile
picture. Those are "non-sensitive" scopes, which **Google does not review**. There is no
demo video, no security assessment, and no scope paperwork to fill in.

What's left is four screens of clicking in the Google Cloud console, and none of it
requires waiting on Google.

---

## Do these four things

All of it lives under **Google Auth Platform** for project `gen-lang-client-0608802366`.

### 1. Remove every Drive and Sheets permission

**Data Access → remove these five:**

- `.../auth/drive`
- `.../auth/drive.readonly`
- `.../auth/drive.file`
- `.../auth/spreadsheets`
- `.../auth/spreadsheets.readonly`

What should remain is only `openid`, `.../auth/userinfo.email`, and
`.../auth/userinfo.profile`. Those three need no review.

This is the step that ends the whole ordeal. Every warning you saw — the missing demo
video, the scope justifications, the "fix the issue" banner — exists only because of the
five permissions above.

### 2. Cancel the pending verification submission

On the **Verification Center** page, hit **Cancel** rather than filling in the appeal
boxes. With no sensitive permissions left there is nothing to verify, so the submission
is moot. Do this after step 1 so the console re-reads your permissions.

### 3. Publish the app

**Audience → Publishing status → Publish app.**

This is the one that actually matters for your business. While the app is in "Testing"
only the handful of test emails you added can sign in, capped at 100. Publishing lifts
that, and real customers can sign up immediately.

### 4. Tidy the branding fields

**Branding:**

| Field | Value |
| --- | --- |
| App name | `Signal87 AI` |
| Application home page | `https://signal87.ai/` |
| Privacy policy link | `https://signal87.ai/privacy` |
| Terms of service link | `https://signal87.ai/terms` |

Also trim **Authorized domains** to 10 or fewer — keep `signal87.ai`,
`gen-lang-client-0608802366.firebaseapp.com`, and `signal-87-2026.vercel.app`, and
delete the rest.

The two findings Google raised — the home page not explaining the app, and the app name
not matching — are already fixed in the deployed site, so these fields will now agree
with what a reviewer sees if anyone ever looks.

---

## What users lost, and what they didn't

Drive import is gone. Users bring documents in by dragging them onto the upload area or
clicking to browse, which already worked and is unchanged.

Nothing else is affected. Sign-in, document analysis, citations, saved reports, and the
whole research flow are untouched.

---

## If you want Drive import back later

It is not lost. Two commits on `claude/vercel-serverless-ai-bf9wyv` contain a working
implementation built on the Google Picker, which uses the per-file `drive.file`
permission — the cheapest path, since it needs no security assessment:

- `c30d707` — the Picker implementation
- `ed440d9` — the scope narrowing it sits on

Reviving it means reverting the removal commit, enabling the **Google Picker API** in the
console, and adding `.../auth/drive.file` back to Data Access. Worth doing only once
customers actually ask for it, because adding any Drive permission puts the app back into
Google's review queue.

---

## What changed in the code

- `index.html` — title, meta description, social tags, and structured data lead with
  "Signal87 AI" and describe the product. A `<noscript>` block carries the purpose and
  policy links, since the app renders client-side and the raw HTML was otherwise empty.
- `public/privacy.html`, `public/terms.html`, `firebase.json` — policy pages served at the
  clean paths `/privacy` and `/terms`.
- `src/lib/firebase.ts` — sign-in requests identity only. The comment there warns against
  re-adding scopes.
- Deleted `src/lib/googleDriveService.ts`, `src/components/GoogleDrivePickerModal.tsx`,
  `src/components/GoogleDriveIntroModal.tsx`, and `src/lib/googleSheetsService.ts` (the
  last was never imported by anything).
- Removed the Drive entry points from the header menu, mobile action sheet, chat attach
  menu, and the first-run Drive intro popup.
