function Badge({ children, className, ...props }) {
  const classes = [
    "inline-flex items-center rounded-full border border-dash-border bg-dash-surface px-2.5 py-1 text-xs font-medium text-dash-muted",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}

export default Badge;
