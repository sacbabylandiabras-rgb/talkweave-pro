import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export function useDeviceType() {
  const isNative = Capacitor.isNativePlatform();
  const [isMobileWeb, setIsMobileWeb] = useState(false);

  useEffect(() => {
    const check = () => setIsMobileWeb(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return {
    isNative,
    isMobile: isNative || isMobileWeb,
    isDesktop: !isNative && !isMobileWeb,
  };
}
