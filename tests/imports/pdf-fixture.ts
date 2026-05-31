export function createSyntheticPdf(input: { pageTexts?: string[]; encrypted?: boolean } = {}): Uint8Array {
  const pageTexts = input.pageTexts ?? ["Chapter One", "Second page text for review"];
  const pages = pageTexts.map((text, index) => {
    const pageObjectId = 3 + index;
    const contentObjectId = 3 + pageTexts.length + index;
    return {
      page: `${pageObjectId} 0 obj\n<< /Type /Page /Parent 2 0 R /Contents ${contentObjectId} 0 R >>\nendobj\n`,
      content: `${contentObjectId} 0 obj\n<< /Length ${text.length + 32} >>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(${escapePdfText(text)}) Tj\nET\nendstream\nendobj\n`,
      pageObjectId,
    };
  });
  const pageRefs = pages.map((page) => `${page.pageObjectId} 0 R`).join(" ");
  const encryptEntry = input.encrypted ? " /Encrypt 9 0 R" : "";
  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R${encryptEntry} >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>\nendobj\n`,
    ...pages.flatMap((page) => [page.page, page.content]),
    "8 0 obj\n<< /Title (Synthetic PDF Fixture) /Producer (Ikis synthetic fixture) >>\nendobj\n",
  ];

  return new TextEncoder().encode(`%PDF-1.4\n${objects.join("")}trailer\n<< /Root 1 0 R /Info 8 0 R >>\n%%EOF\n`);
}

function escapePdfText(text: string): string {
  return text.replace(/[()\\]/g, (character) => `\\${character}`);
}
