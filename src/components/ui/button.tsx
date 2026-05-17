import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-xl px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const button = (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );

    // Check for active theme via CSS class or attribute
    const [activeTheme, setActiveTheme] = React.useState<string | null>(null);

    React.useEffect(() => {
      const checkTheme = () => {
        const isDark = document.documentElement.classList.contains("dark");
        const themeAttr = document.documentElement.getAttribute("data-theme");
        setActiveTheme(isDark ? "purple" : themeAttr);
      };

      checkTheme();

      const observer = new MutationObserver(checkTheme);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      });

      return () => observer.disconnect();
    }, []);

    const shouldShowSpinningBorder = 
      className?.includes("spinning-border") || 
      activeTheme === "purple" || 
      activeTheme === "white";

    if (shouldShowSpinningBorder) {
      const isSmall = size === "sm" || size === "icon" || className?.includes("h-8");
      const borderRadius = className?.includes("rounded-full") ? "9999px" : "0.75rem";
      
      return (
        <div 
          className="spinning-border-outer" 
          style={{ 
            borderRadius,
            padding: isSmall ? "1.5px" : "2.5px"
          }}
        >
          {button}
        </div>
      );
    }

    return button;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
