const BLOCK_TAG_PATTERN = /<\/?(?:address|article|aside|blockquote|br|div|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|td|th|tr|ul)\b[^>]*>/gi;

export function stripXmlDeclaration(xml: string): string {
  return xml.replace(/^\s*<\?xml[^>]*>\s*/i, "");
}

export function htmlToText(html: string): string {
  return decodeXmlEntities(
    stripXmlDeclaration(html)
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(BLOCK_TAG_PATTERN, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/ *\n+ */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

export function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

export function textContentForTag(xml: string, tagName: string): string[] {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`, "gi");
  const values: string[] = [];
  let match = pattern.exec(xml);
  while (match !== null) {
    const text = htmlToText(match[1]);
    if (text.length > 0) {
      values.push(text);
    }
    match = pattern.exec(xml);
  }
  return values;
}

export function firstAttribute(tag: string, attribute: string): string | null {
  const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escapedAttribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i");
  const match = pattern.exec(tag);
  return match ? decodeXmlEntities(match[1] ?? match[2] ?? "") : null;
}
