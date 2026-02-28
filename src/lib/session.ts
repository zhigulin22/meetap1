export function detectDeviceLabel(userAgent: string) {
  const ua = userAgent.toLowerCase();

  const platform = ua.includes("iphone") || ua.includes("ipad")
    ? "iOS"
    : ua.includes("android")
      ? "Android"
      : ua.includes("mac os") || ua.includes("macintosh")
        ? "macOS"
        : ua.includes("windows")
          ? "Windows"
          : ua.includes("linux")
            ? "Linux"
            : "Unknown";

  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("chrome/")
      ? "Chrome"
      : ua.includes("safari/") && !ua.includes("chrome/")
        ? "Safari"
        : ua.includes("firefox/")
          ? "Firefox"
          : "Browser";

  return `${platform} · ${browser}`;
}
