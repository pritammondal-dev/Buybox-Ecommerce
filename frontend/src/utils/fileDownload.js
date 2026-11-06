/**
 * Trigger client-side file download from Axios response blob or direct Blob instance.
 */
export const triggerBlobDownload = (res, defaultFilename = "export.csv") => {
  if (!res) return;

  // Resolve blob whether passed as:
  // 1) Direct Blob instance (from apiClient interceptor returning response.data)
  // 2) AxiosResponse object { data: Blob, headers: ... }
  // 3) String / ArrayBuffer data
  let blob = null;
  let filename = defaultFilename;

  if (res instanceof Blob) {
    blob = res;
  } else if (res.data instanceof Blob) {
    blob = res.data;
    const disposition = res.headers?.["content-disposition"] || "";
    const match = disposition.match(/filename="?([^";]+)"?/i);
    if (match && match[1]) {
      filename = match[1];
    }
  } else if (res.data && res.data !== "undefined") {
    blob = new Blob([res.data]);
  } else if (typeof res === "string" && res !== "undefined") {
    blob = new Blob([res], { type: "text/csv;charset=utf-8;" });
  } else if (res && typeof res === "object" && !(res instanceof Blob)) {
    blob = new Blob([res]);
  }

  // Safety check: Don't trigger download if blob is 0 bytes or literal "undefined"
  if (!blob || blob.size === 0) {
    console.error("triggerBlobDownload: Empty or invalid blob received, aborting download");
    return;
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export default triggerBlobDownload;
