function StatRow({ label, value, className }) {
  const classes = [
    "flex items-center justify-between text-sm text-zb-ink-muted",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <span>{label}</span>
      <span className="text-zb-ink">{value}</span>
    </div>
  );
}

export default StatRow;
