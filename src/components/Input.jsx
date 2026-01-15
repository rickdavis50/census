function Input({ className, ...props }) {
  const classes = [
    "w-full rounded-zb-md border border-zb-border bg-zb-surface px-3 py-2 text-sm text-zb-ink placeholder:text-zb-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zb-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zb-bg",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <input className={classes} {...props} />;
}

export default Input;
