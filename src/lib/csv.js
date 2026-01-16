const escapeValue = (value) => {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes('"') || stringValue.includes(",") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export const buildCsv = (headers, rows) => {
  const lines = [];
  if (headers?.length) {
    lines.push(headers.map(escapeValue).join(","));
  }
  rows.forEach((row) => {
    lines.push(row.map(escapeValue).join(","));
  });
  return lines.join("\r\n");
};

export const downloadCsv = (filename, headers, rows) => {
  const csv = buildCsv(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
