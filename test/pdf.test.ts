import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { extractPdfText } from "@/lib/resume";
import { readResumeUpload } from "@/lib/validation";
import { ApiError } from "@/lib/http";

const pdf = () => new Uint8Array(readFileSync(new URL("../scripts/resume.pdf", import.meta.url)));

it("extracts text from a real PDF buffer", async () => {
  const text = await extractPdfText(pdf().buffer as ArrayBuffer);
  expect(text).toContain("Priya Sharma");
  expect(text).toContain("React");
  expect(text.length).toBeGreaterThan(200);
});

it("rejects a non-PDF upload", async () => {
  const form = new FormData();
  form.append("file", new File(["hello"], "resume.pdf", { type: "application/pdf" }));
  await expect(readResumeUpload(form)).rejects.toThrow(/not a valid PDF/i);
});

it("rejects a non-PDF extension", async () => {
  const form = new FormData();
  form.append("file", new File(["hello"], "resume.txt", { type: "text/plain" }));
  await expect(readResumeUpload(form)).rejects.toThrow(/Only PDF/i);
});

it("rejects an empty file", async () => {
  const form = new FormData();
  form.append("file", new File([], "resume.pdf", { type: "application/pdf" }));
  await expect(readResumeUpload(form)).rejects.toThrow(/empty/i);
});

it("rejects a missing file", async () => {
  await expect(readResumeUpload(new FormData())).rejects.toThrow(/No file/i);
});

it("rejects a corrupted PDF with a readable error", async () => {
  const broken = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 1, 2, 3, 4, 5]);
  await expect(extractPdfText(broken.buffer as ArrayBuffer)).rejects.toThrow(ApiError);
});

it("rejects an unreadable or empty PDF with a message a person can act on", async () => {
  const blank = new TextEncoder().encode("%PDF-1.4\ntrailer\n<<>>\n%%EOF\n");
  // A scanned image and a broken file are indistinguishable here; both must
  // produce a readable error, never a stack trace.
  await expect(extractPdfText(blank.buffer as ArrayBuffer)).rejects.toThrow(ApiError);
  await expect(extractPdfText(blank.buffer as ArrayBuffer)).rejects.toThrow(/PDF/i);
});
