import { getDocumentProxy, getResolvedPDFJS } from "unpdf";
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  TextContent,
  TextItem,
} from "unpdf/types/src/display/api.d.ts";
import { PageViewport } from "unpdf/types/web/interfaces.d.ts";

const pdfjs = await getResolvedPDFJS();

const data = Deno.readFileSync(Deno.args[0]);
const doc = await getDocumentProxy(data);

export type BoundingBox<AnchorT extends string = never> = {
  x0: number | AnchorT;
  y0: number | AnchorT;
  y1: number | AnchorT;
  x1: number | AnchorT;
};

export function bbox(...[x0, y0, x1, y1]: number[]): BoundingBox {
  return { x0, y0, x1, y1 };
}

export function bboxCenter(bbox: BoundingBox): [number, number] {
  return [(bbox.x0 + bbox.x1) / 2, (bbox.y0 + bbox.y1) / 2];
}

export function isContained(outer: BoundingBox, inner: BoundingBox): boolean {
  return (inner.x0 >= outer.x0 && inner.x0 <= outer.x1) && // inner lhs in outer
    (inner.x1 >= outer.x0 && inner.x1 <= outer.x1) && // inner rhs in outer
    (inner.y0 >= outer.y0 && inner.y0 <= outer.y1) && // inner top in outer
    (inner.y1 >= outer.y0 && inner.y1 <= outer.y1); // inner bottom in outer
}

export function bboxDist(
  b0: BoundingBox,
  b1: BoundingBox,
  axis?: "x" | "y",
): number {
  let [x1, y1] = bboxCenter(b0);
  let [x2, y2] = bboxCenter(b1);
  if (axis === "x") {
    y1 = y2 = 0;
  }
  if (axis === "y") {
    x1 = x2 = 0;
  }
  [x1, x2] = isFinite(x1) && !isNaN(x1) && isFinite(x2) && !isNaN(x2)
    ? [x1, x2]
    : [0, 0];
  [y1, y2] = isFinite(y1) && !isNaN(y1) && isFinite(y2) && !isNaN(y2)
    ? [y1, y2]
    : [0, 0];
  return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

export class Anchor {
  constructor(
    public parent: TextExtractor,
    public bbox: BoundingBox,
    public selection?: TextItem,
  ) {
  }

  private with(opts: { bbox?: BoundingBox; selection?: TextItem }) {
    return new Anchor(
      this.parent,
      opts.bbox ?? this.bbox,
      opts.selection ?? this.selection,
    );
  }

  get str(): string {
    return this.selection!.str;
  }

  all(): TextItem[] {
    return this.parent.getTextItems().filter((t) =>
      isContained(this.bbox, this.parent.textBoundingBox(t))
    );
  }

  after(): Anchor {
    return this.with({
      bbox: bbox(this.bbox.x1, -Infinity, +Infinity, +Infinity),
    });
  }

  before(): Anchor {
    return this.with({
      bbox: bbox(-Infinity, -Infinity, this.bbox.x0, +Infinity),
    });
  }

  above(): Anchor {
    return this.with({
      bbox: bbox(-Infinity, -Infinity, +Infinity, this.bbox.y0),
    });
  }

  below(): Anchor {
    return this.with({
      bbox: bbox(-Infinity, this.bbox.y1, +Infinity, +Infinity),
    });
  }

  // select the next closest element within the bounds
  selectClosests(axis?: "x" | "y"): Anchor {
    const targetBBox = this.selection !== undefined
      ? this.parent.textBoundingBox(this.selection)
      : this.bbox;

    const selection = this
      .all()
      .toSorted((a, b) =>
        bboxDist(targetBBox, this.parent.textBoundingBox(a), axis) -
        bboxDist(targetBBox, this.parent.textBoundingBox(b), axis)
      )[0];
    return this.with({
      selection,
      bbox: this.parent.textBoundingBox(selection),
    });
  }
}

export class TextExtractor {
  public viewport: PageViewport;
  constructor(
    public readonly page: PDFPageProxy,
    public readonly text: TextContent,
  ) {
    this.page = page;
    this.text = text;
    this.viewport = this.page.getViewport({ scale: 1. });
  }

  get pageBoundingBox(): BoundingBox {
    const bbBottomRight = pdfjs.Util.applyTransform(
      [this.viewport.width, this.viewport.height],
      this.viewport.transform,
    );
    return bbox(0, 0, ...bbBottomRight);
  }

  textBoundingBox(t: TextItem): BoundingBox {
    // SOURCE: https://github.com/mozilla/pdf.js/blob/53dfb5a6baebe7ceff49f702366ae55963cd4f17/examples/text-only/pdf2svg.mjs
    // we have to take in account viewport transform, which includes scale,
    // rotation and Y-axis flip, and not forgetting to flip text.

    const bbTopLeft = pdfjs.Util.applyTransform(
      [0, 0],
      pdfjs.Util.transform(this.viewport.transform, t.transform),
    );

    return bbox(...bbTopLeft, bbTopLeft[0] + t.width, bbTopLeft[1] + t.height);
  }

  getTextItems(): TextItem[] {
    return this.text.items
      .filter((t): t is TextItem => "str" in t)
      .filter((t) => t.width > 0 && t.height > 0);
  }

  anchor(text: string | RegExp): Anchor {
    const t = this
      .getTextItems()
      .find((t) =>
        typeof text === "string" ? (t.str === text) : text.test(t.str)
      )!;
    const bbox = this.textBoundingBox(t);

    return new Anchor(this, bbox, t);
  }
}

const p1 = await doc.getPage(1);
const test = new TextExtractor(p1, await p1.getTextContent());

const nameAnchor = test.anchor("NAME").below().selectClosests("x");
const cardNumber = test.anchor("ACCOUNT NUMBER").below().selectClosests().str;

function readTableRow(test: Anchor): [string, string, string] {
  const descAnchor = test.after().selectClosests("y");
  const idAnchor = descAnchor.below().selectClosests();
}
