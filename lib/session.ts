export function detectDeviceLabel(userAgent: string) {
  const ua = userAgent.toLowerCase();

  const os =
    ua.includes("iphone") || ua.includes("ipad")
      ? "iOS"
      : ua.includes("android")
        ? "Android"
        : ua.includes("windows")
          ? "Windows"
          : ua.includes("mac os") || ua.includes("macintosh")
            ? "macOS"
            : "Unknown OS";

  const browser =
    ua.includes("edg/")
      ? "Edge"
      : ua.includes("chrome/") && !ua.includes("edg/")
        ? "Chrome"
        : ua.includes("safari/") && !ua.includes("chrome/")
          ? "Safari"
          : ua.includes("firefox/")
            ? "Firefox"
            : "Browser";

  const mobile = ua.includes("mobile") || ua.includes("android") || ua.includes("iphone");

  return `${mobile ? "Phone" : "Desktop"} · ${os} · ${browser}`;
}
