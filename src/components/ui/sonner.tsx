import { useTheme } from "next-themes";
import { useEffect } from "react";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  useEffect(() => {
    const hideRawDisconnectedToast = () => {
      document.querySelectorAll('[data-sonner-toast]').forEach((node) => {
        const text = node.textContent?.trim().toLowerCase() || "";
        if (text === "whatsapp disconnected" || text.includes("whatsapp disconnected")) {
          console.warn("[Toast] Alerta cru de conexão suprimido", { text });
          node.remove();
        }
      });
    };

    hideRawDisconnectedToast();
    const observer = new MutationObserver(hideRawDisconnectedToast);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-3xl !border !border-white/10 !bg-black/55 !text-white !backdrop-blur-2xl !shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] !px-4 !py-3",
          title: "!text-[15px] !font-semibold !text-white",
          description: "!text-[13px] !text-white/70",
          actionButton: "group-[.toast]:!bg-white/15 group-[.toast]:!text-white group-[.toast]:!rounded-full",
          cancelButton: "group-[.toast]:!bg-white/10 group-[.toast]:!text-white/80 group-[.toast]:!rounded-full",
          icon: "!text-white",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
