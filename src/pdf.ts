import { PDFDocument, StandardFonts, PageSizes } from "pdf-lib";
import { PAGES, LINES, CHARS, PAGE_LENGTH } from "./constants";

const MARGIN = 48;
const TOP = PageSizes.A4[1] - MARGIN;
const FONT_SIZE = 10;

const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

export async function generatePdf(
  content: string,
  roomShort: string,
  hash: string,
  wall: string,
  shelf: string,
  book: string
): Promise<Buffer> {
  const document = await PDFDocument.create();
  const monospaceFont = await document.embedFont(StandardFonts.Courier);

  const pages: string[][] = [];

  while (pages.length < PAGES) {
    const docPage = document.addPage(PageSizes.A4);

    let top = TOP;

    docPage.drawText("https://libraryofbabel.app/", {
      x: MARGIN,
      y: top,
      size: FONT_SIZE,
      font: monospaceFont,
    });

    top -= FONT_SIZE + 2;
    docPage.drawText(`Generated ${new Date().toISOString()}`, {
      x: MARGIN,
      y: top,
      size: FONT_SIZE,
      font: monospaceFont,
    });

    top -= MARGIN / 2;
    docPage.drawText(
      `Room ${roomShort} / Wall ${wall} / Shelf ${shelf} / Book ${book} / Page ${
        pages.length + 1
      }`,
      {
        x: MARGIN,
        y: top,
        size: FONT_SIZE,
        font: monospaceFont,
      }
    );

    top -= FONT_SIZE + 2;
    docPage.drawText(`Bookmark ${hash}`, {
      x: MARGIN,
      y: top,
      size: FONT_SIZE,
      font: monospaceFont,
    });

    docPage.drawText(`${pages.length + 1}`, {
      x: MARGIN,
      y: MARGIN,
      size: FONT_SIZE,
      font: monospaceFont,
    });

    const pStart = pages.length * PAGE_LENGTH;
    const chunk = content.substring(pStart, pStart + PAGE_LENGTH);

    const lines = [];

    top -= MARGIN / 2;

    while (lines.length < LINES) {
      const lStart = lines.length * CHARS;
      const line = chunk.substring(lStart, lStart + CHARS);

      docPage.drawText(`${pad(lines.length + 1)} ${line}`, {
        x: MARGIN,
        y: top,
        size: FONT_SIZE,
        font: monospaceFont,
      });

      top -= FONT_SIZE;

      lines.push(line);
    }

    pages.push(lines);
  }

  const bytes = await document.save();
  return Buffer.from(bytes);
}
