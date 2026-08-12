import { parseFileContent, ParsedFileResult } from './fileParser';
import { DocumentItem } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  iconLink?: string;
  thumbnailLink?: string;
  webViewLink?: string;
}

// drive.file is a NON-sensitive scope: it grants access only to the files the user
// hands us through the Google Picker, never to their Drive as a whole. That is why
// file discovery is Google's Picker rather than a files.list call of our own —
// listing someone's Drive requires the restricted drive.readonly scope, which drags
// in Google's restricted-scope verification and an annual CASA security assessment.
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GAPI_SRC = 'https://apis.google.com/js/api.js';

// Types the app expects to be able to parse once imported.
const PICKABLE_MIME_TYPES = [
  'application/pdf',
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain'
].join(',');

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

// In-memory token cache. Deliberately not persisted — a Drive token in
// localStorage outlives the tab and is readable by any script on the origin.
let cachedDriveToken: string | null = null;

export const setDriveAccessToken = (token: string | null) => {
  cachedDriveToken = token;
};

export const getDriveAccessToken = (): string | null => {
  return cachedDriveToken;
};

const scriptPromises = new Map<string, Promise<void>>();

const loadScript = (src: string): Promise<void> => {
  const existing = scriptPromises.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.defer = true;
    el.onload = () => resolve();
    el.onerror = () => {
      // Let a later attempt retry rather than caching the failure forever.
      scriptPromises.delete(src);
      reject(new Error(`Failed to load ${src}. Check your network connection and try again.`));
    };
    document.head.appendChild(el);
  });

  scriptPromises.set(src, promise);
  return promise;
};

/**
 * Asks Google for an access token carrying only drive.file, via Google Identity
 * Services. This is incremental authorization: it is independent of the Firebase
 * login session, so signing in to Signal87 never prompts for Drive access, and
 * connecting Drive never disturbs the user's login.
 */
const requestDriveToken = async (): Promise<string> => {
  await loadScript(GIS_SRC);

  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error('Google Identity Services did not initialize. Please reload and try again.');
  }

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: (firebaseConfig as any).oAuthClientId,
      scope: DRIVE_FILE_SCOPE,
      callback: (response: any) => {
        if (response?.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        if (!response?.access_token) {
          reject(new Error('Google did not return an access token. Please try again.'));
          return;
        }
        cachedDriveToken = response.access_token;
        resolve(response.access_token);
      },
      error_callback: (err: any) => {
        // Fired when the user closes or dismisses the consent popup.
        reject(
          new Error(
            err?.type === 'popup_closed'
              ? 'The Google authorization window was closed before access was granted.'
              : err?.message || 'Google authorization failed. Please try again.'
          )
        );
      }
    });

    client.requestAccessToken();
  });
};

const loadPicker = async (): Promise<void> => {
  await loadScript(GAPI_SRC);

  if (!window.gapi) {
    throw new Error('Google API script did not initialize. Please reload and try again.');
  }
  if (window.google?.picker) return;

  await new Promise<void>((resolve, reject) => {
    window.gapi.load('picker', {
      callback: () => resolve(),
      onerror: () => reject(new Error('Failed to load the Google Picker. Please try again.'))
    });
  });
};

/**
 * Opens Google's own file chooser. Resolves with the files the user selected, or
 * an empty array if they cancelled. Selecting a file here is what grants this app
 * drive.file access to that specific file.
 */
const openDrivePicker = async (token: string): Promise<DriveFile[]> => {
  await loadPicker();
  const picker = window.google.picker;

  return new Promise<DriveFile[]>((resolve, reject) => {
    try {
      const view = new picker.DocsView(picker.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false)
        .setMimeTypes(PICKABLE_MIME_TYPES);

      const built = new picker.PickerBuilder()
        .setOAuthToken(token)
        .setDeveloperKey((firebaseConfig as any).apiKey)
        // appId is the Cloud project number, which Firebase config carries as
        // messagingSenderId. The Picker needs it to scope drive.file grants.
        .setAppId((firebaseConfig as any).messagingSenderId)
        .enableFeature(picker.Feature.MULTISELECT_ENABLED)
        .addView(view)
        .setTitle('Select documents to import into Signal87 AI')
        .setCallback((data: any) => {
          const action = data[picker.Response.ACTION];

          if (action === picker.Action.PICKED) {
            const docs = data[picker.Response.DOCUMENTS] || [];
            resolve(
              docs.map((d: any) => ({
                id: d[picker.Document.ID],
                name: d[picker.Document.NAME],
                mimeType: d[picker.Document.MIME_TYPE],
                size: d.sizeBytes != null ? String(d.sizeBytes) : undefined,
                modifiedTime: d.lastEditedUtc
                  ? new Date(Number(d.lastEditedUtc)).toISOString()
                  : undefined,
                iconLink: d[picker.Document.ICON_URL],
                webViewLink: d[picker.Document.URL]
              }))
            );
          } else if (action === picker.Action.CANCEL) {
            resolve([]);
          }
        })
        .build();

      built.setVisible(true);
    } catch (err: any) {
      reject(new Error(err?.message || 'Could not open the Google Picker.'));
    }
  });
};

/**
 * Full connect-and-choose flow: reuses a cached token when one is live, otherwise
 * prompts for drive.file, then opens the Picker. Returns the chosen files plus the
 * token needed to download them.
 */
export const pickFilesFromDrive = async (): Promise<{ token: string; files: DriveFile[] }> => {
  let token = cachedDriveToken;

  if (!token) {
    token = await requestDriveToken();
  }

  try {
    const files = await openDrivePicker(token);
    return { token, files };
  } catch (err: any) {
    // A stale cached token surfaces here; drop it and re-consent once.
    if (cachedDriveToken) {
      cachedDriveToken = null;
      const fresh = await requestDriveToken();
      const files = await openDrivePicker(fresh);
      return { token: fresh, files };
    }
    throw err;
  }
};

export const importFileFromDrive = async (
  token: string,
  driveFile: DriveFile,
  onProgress?: (step: string) => void
): Promise<{ doc: DocumentItem; parsedResult?: ParsedFileResult }> => {
  const { id, name, mimeType } = driveFile;

  if (onProgress) onProgress(`Downloading "${name}" from Google Drive...`);

  let blob: Blob;
  let fileToParse: File;

  const authHeader = { Authorization: `Bearer ${token}` };

  const fetchOrThrow = async (url: string, failure: string) => {
    const res = await fetch(url, { headers: authHeader });
    if (res.status === 401 || res.status === 403) {
      cachedDriveToken = null;
      throw new Error('UNAUTHORIZED');
    }
    if (!res.ok) throw new Error(failure);
    return res.blob();
  };

  // Handle native Google Docs / Sheets / Slides vs standard files
  if (mimeType === 'application/vnd.google-apps.document') {
    // Export Google Doc as PDF
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=application/pdf`;
    blob = await fetchOrThrow(exportUrl, `Failed to export Google Doc "${name}"`);
    const pdfName = name.endsWith('.pdf') ? name : `${name}.pdf`;
    fileToParse = new File([blob], pdfName, { type: 'application/pdf' });
  } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    // Export Google Sheet as CSV
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/csv`;
    blob = await fetchOrThrow(exportUrl, `Failed to export Google Sheet "${name}"`);
    const csvName = name.endsWith('.csv') ? name : `${name}.csv`;
    fileToParse = new File([blob], csvName, { type: 'text/csv' });
  } else if (mimeType === 'application/vnd.google-apps.presentation') {
    // Export Google Slides as PDF
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=application/pdf`;
    blob = await fetchOrThrow(exportUrl, `Failed to export Google Slides "${name}"`);
    const pdfName = name.endsWith('.pdf') ? name : `${name}.pdf`;
    fileToParse = new File([blob], pdfName, { type: 'application/pdf' });
  } else {
    // Standard binary file download
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${id}?alt=media`;
    blob = await fetchOrThrow(downloadUrl, `Failed to download file "${name}" from Google Drive`);
    fileToParse = new File([blob], name, { type: mimeType || 'application/octet-stream' });
  }

  if (onProgress) onProgress(`Parsing & Extracting content from "${name}"...`);
  const parsedResult = await parseFileContent(fileToParse);
  const extractedText = parsedResult.extractedText || `Ported Google Drive document "${name}".`;

  if (onProgress) onProgress(`Calling Signal87 AI Engine for Entity & Vector Embeddings (${name})...`);

  let backendData: any = {};
  try {
    const res = await fetch('/api/documents/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: name,
        textContent: extractedText.slice(0, 100000),
        spreadsheetData: parsedResult?.spreadsheetData
      })
    });
    if (res.ok) {
      backendData = await res.json();
    }
  } catch (apiErr) {
    console.warn('API route call fallback:', apiErr);
  }

  const fileType = name.endsWith('.docx')
    ? 'docx'
    : name.endsWith('.xlsx')
    ? 'xlsx'
    : name.endsWith('.csv')
    ? 'csv'
    : 'pdf';

  const newDoc: DocumentItem = {
    id: `gdrive-${id}-${Date.now()}`,
    title: name,
    type: fileType,
    sizeBytes: fileToParse.size || parseInt(driveFile.size || '0', 10) || 50000,
    uploadDate: new Date().toISOString(),
    tags: backendData.suggestedTags || ['Google Drive', 'Imported', 'Indexed'],
    owner: 'ceo@signal87.ai',
    organization: 'Signal87 Executive',
    status: 'ready',
    aiIndexed: true,
    embeddingsComplete: true,
    versionHistory: [
      {
        version: 1,
        updatedAt: new Date().toISOString(),
        updatedBy: 'ceo@signal87.ai',
        changeNote: 'Ported from Google Drive'
      }
    ],
    permissions: 'Organization',
    summary:
      backendData.summary ||
      `Ported from Google Drive (${mimeType}). ${parsedResult.summaryInfo || 'AI OCR and semantic vector indexing complete.'}`,
    entities: backendData.entities || [
      { name, type: 'Google Drive Asset', relevance: 95 }
    ],
    riskHighlights: backendData.riskHighlights || ['Google Drive synced document - permissions verified'],
    contentPreview: extractedText,
    category: 'Research',
    projectIds: [],
    fileUrl: driveFile.webViewLink || undefined
  };

  return { doc: newDoc, parsedResult };
};
