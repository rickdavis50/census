const baseClasses =
  "inline-flex items-center justify-center rounded-zb-md border text-sm font-medium font-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zb-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zb-bg disabled:cursor-not-allowed disabled:opacity-50";

const variants = {
  primary: "bg-zb-green text-zb-black border-zb-green",
  secondary: "bg-zb-surface text-zb-ink border-zb-border",
  ghost: "bg-transparent text-zb-ink border-transparent",
};

const sizes = {
  sm: "h-8 px-3",
  md: "h-10 px-4",
};

function Button({
  children,
  className,
  type = "button",
  variant = "primary",
  size = "md",
  ...props
}) {
  const classes = [
    baseClasses,
    variants[variant],
    sizes[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}

export default Button;
