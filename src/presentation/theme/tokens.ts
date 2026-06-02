export const glassTokens = {
  radius: { card: "rounded-lg", control: "rounded-md" },
  surface: "border border-white/40 bg-white/70 shadow-glass backdrop-blur-glass dark:border-white/10 dark:bg-white/8 dark:shadow-glass-dark",
  panel: "border border-white/35 bg-white/60 backdrop-blur-glass dark:border-white/10 dark:bg-white/7",
  interactive: "transition duration-150 ease-out hover:bg-white/80 active:scale-[0.99] dark:hover:bg-white/12",
  focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
} as const;
