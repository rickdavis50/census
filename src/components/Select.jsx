function Select({ className, children, ...props }) {
  const classes = [
    "w-full rounded-dash-md border border-dash-border bg-dash-surface px-3 py-2 text-sm text-dash-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent-3 focus-visible:ring-offset-2 focus-visible:ring-offset-dash-bg",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <select className={classes} {...props}>
      {children}
    </select>
  );
}

export default Select;
