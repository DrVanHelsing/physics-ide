/**
 * downloadCsv — one CSV writer.
 *
 * This function existed twice, verbatim, in DebugMode's toolbar CSV button and
 * in TraceTable's `exportRecordingCsv`, behind two controls that were on
 * screen at the same time with different labels and different disabled rules.
 *
 * `toCsvRows` is the pure half and is what the test covers; the download
 * itself is three lines of DOM.
 */

/** @param {Array<{t:number,name:string,value:unknown,delta:*,min:*,max:*}>} buffer */
export function toCsvRows(buffer) {
  const header = "timestamp_ms,variable,value,delta,min,max";
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = (buffer || []).map(
    (r) => `${r.t},${esc(r.name)},${esc(r.value)},${r.delta ?? ""},${r.min ?? ""},${r.max ?? ""}`,
  );
  return [header, ...rows].join("\n") + "\n";
}

export function downloadCsv(buffer, filename = `recording_${Date.now()}.csv`) {
  if (!buffer || buffer.length === 0) return false;
  const blob = new Blob([toCsvRows(buffer)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
