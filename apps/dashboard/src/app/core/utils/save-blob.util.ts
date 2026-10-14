/** Makes the browser save `blob` as `filename` (the file an XHR/fetch fetched can't be "opened" as a normal download link). */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Not right away: Firefox and some Safari versions start the download asynchronously and would
  // otherwise read a released blob, saving an empty file.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
