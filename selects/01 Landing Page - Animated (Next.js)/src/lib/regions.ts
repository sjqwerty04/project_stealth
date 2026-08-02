// Map browser locale to TMDB region code
export function detectRegion(): string {
  if (typeof navigator === "undefined") return "US";

  const lang = navigator.language || "en-US";
  const parts = lang.split("-");
  const country = parts[1]?.toUpperCase() || "";

  const regionMap: Record<string, string> = {
    IN: "IN",
    KR: "KR",
    JP: "JP",
    CN: "CN",
    FR: "FR",
    DE: "DE",
    ES: "ES",
    BR: "BR",
    MX: "MX",
    IT: "IT",
    GB: "GB",
    AU: "AU",
    CA: "CA",
  };

  return regionMap[country] || "US";
}
