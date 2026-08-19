import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: { center: true, padding: "1rem" },
    extend: {
      // Without this, Tailwind's `font-sans` utility (used on <body>) falls
      // back to its own built-in system stack and silently ignores the
      // Inter variable next/font sets on <html> — found while verifying the
      // Control Room font swap (roadmap #7); pre-existing, not introduced
      // by that change.
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: "hsl(142 71% 45%)",
        warning: "hsl(38 92% 50%)",
        "stamp-amber": "hsl(var(--stamp-amber))",
        "stamp-green": "hsl(var(--stamp-green))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "pill-settle": {
          "0%, 60%": { transform: "scale(1)" },
          "70%": { transform: "scale(1.12)" },
          "82%": { transform: "scale(0.96)" },
          "100%": { transform: "scale(1)" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.9" },
          "100%": { transform: "scale(1.5)", opacity: "0" },
        },
        "scan-sweep": {
          "0%": { backgroundPosition: "120% 0" },
          "100%": { backgroundPosition: "-120% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pill-settle": "pill-settle 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        rise: "rise 0.5s ease forwards",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
        "scan-sweep": "scan-sweep 2.2s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
