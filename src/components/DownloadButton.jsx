import { downloadCsv } from "../lib/csv";

function DownloadButton({ filename, headers, rows, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => downloadCsv(filename, headers, rows)}
      className="rounded-dash-md border border-dash-border bg-dash-surface px-3 py-2 text-xs font-medium text-dash-muted transition hover:text-dash-ink disabled:cursor-not-allowed disabled:opacity-50"
    >
      Download CSV
    </button>
  );
}

export default DownloadButton;
