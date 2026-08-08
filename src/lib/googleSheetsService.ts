export const fetchSpreadsheetData = async (accessToken: string, spreadsheetId: string, range: string) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch spreadsheet data');
  }
  return response.json();
};
