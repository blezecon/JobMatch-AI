import { extractText, getDocumentProxy } from "unpdf";
import { ApiError } from "./http";

/**
 * The uploaded PDF is parsed in memory and never written to disk, so there is no
 * temp file to leak and nothing to clean up afterwards.
 */
export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  let document: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    document = await getDocumentProxy(new Uint8Array(buffer));
  } catch {
    throw new ApiError(
      "We could not read that PDF — it may be corrupted or password protected.",
      422,
      "Try exporting it again from your editor, or upload a different file.",
    );
  }

  let text: string;
  try {
    ({ text } = await extractText(document, { mergePages: true }));
  } catch {
    throw new ApiError("We could not read the text inside that PDF.", 422);
  }

  const cleaned = text
    .replace(/\r/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length < 40) {
    throw new ApiError(
      "That PDF has no selectable text.",
      422,
      "Scanned or image-only PDFs cannot be parsed. Export a text-based PDF and try again.",
    );
  }
  return cleaned;
}