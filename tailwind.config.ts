import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./src/presentation/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "Geist", "system-ui", "sans-serif"]
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: "hsl(var(--muted))",
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        surface: "hsl(var(--surface))",
        accent: "hsl(var(--accent))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--danger))"
      },
      boxShadow: {
        glass: "0 18px 60px rgba(15, 23, 42, 0.12)",
        "glass-dark": "0 18px 70px rgba(0, 0, 0, 0.38)"
      },
      backdropBlur: {
        glass: "24px"
      }
    }
  },
  plugins: []
};

export default config;
