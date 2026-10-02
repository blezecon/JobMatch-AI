import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Minimal single-page PDF with a text stream. Enough to exercise unpdf.
const lines = [
  "Priya Sharma",
  "priya.sharma@example.com | Kolkata, India",
  "",
  "SUMMARY",
  "Final-year Computer Science student building web applications.",
  "",
  "SKILLS",
  "JavaScript, React, Git, HTML, CSS, Node.js, PostgreSQL",
  "",
  "EXPERIENCE",
  "Frontend Developer Intern, Acme Software, June 2023 - Nov 2023",
  "- Built a Student Feedback System in React used by 500 students",
  "- Wrote unit tests for the reporting module",
  "",
  "PROJECTS",
  "Student Feedback System - React dashboard for course feedback",
  "Weather Now - Node.js and Express API with a static frontend",
  "",
  "EDUCATION",
  "B.Tech Computer Science, University of Calcutta, 2024",
];

const escape = (text) => text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const content = [
  "BT",
  "/F1 12 Tf",
  "14 TL",
  "50 780 Td",
  ...lines.map((line, index) =>
    index === 0 ? `(${escape(line)}) Tj` : `T* (${escape(line)}) Tj`,
  ),
  "ET",
].join("\n");

const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
  `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
];

let pdf = "%PDF-1.4\n";
const offsets = [];
objects.forEach((body, index) => {
  offsets.push(pdf.length);
  pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
});

const xrefStart = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

writeFileSync(fileURLToPath(new URL("./resume.pdf", import.meta.url)), pdf, "latin1");
console.log("wrote", pdf.length, "bytes");