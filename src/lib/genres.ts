const genreAliases: Record<string, string> = {
  hiphop: "Hip Hop",
  rap: "Hip Hop",
  trap: "Hip Hop",
  rnb: "R&B",
  rbsoul: "R&B",
  soulrnb: "R&B",
  randb: "R&B",
  alternativerock: "Alternative Rock",
  altrock: "Alternative Rock",
  indiepop: "Indie Pop",
  indierock: "Indie Rock",
  electronica: "Electronic",
  electronic: "Electronic",
  edm: "Electronic",
};

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeGenre(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return "";
  }

  const compactKey = trimmed
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[\/_|-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, "");

  if (genreAliases[compactKey]) {
    return genreAliases[compactKey];
  }

  const cleaned = trimmed
    .replace(/[\/_|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return titleCase(cleaned);
}
