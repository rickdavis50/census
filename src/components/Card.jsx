function Card({ children, className, ...props }) {
  const classes = [
    "dash-card",
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
