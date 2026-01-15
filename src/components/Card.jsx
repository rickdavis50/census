function Card({ children, className, ...props }) {
  const classes = [
    "rounded-zb-lg border border-zb-border bg-zb-surface shadow-zb-1",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

export default Card;
