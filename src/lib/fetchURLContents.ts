import * as cheerio from "cheerio";

export async function fetchURLContents(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; LLMFetcher/1.0)",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) return "Failed to fetch URL";

  const html = await response.text();
  const $ = cheerio.load(html);

  $(
    // Expanded list to include more non-content/boilerplate tags
    "head, img, script, style, link, noscript, iframe, svg, nav, footer, header, form, input, button, select, option, label, canvas, figure, figcaption, object, embed, video, audio, source, track, picture, map, area, meta, base, col, colgroup, frame, frameset, param, dialog, template, menu, menuitem, output, progress",
  ).remove();

  // Traverse body tag's children and extract text content
  let cleanText = "";
  const body = $("body");

  function traverse(element: ReturnType<typeof $>) {
    element.contents().each((_, node) => {
      if (node.type === "text") {
        const text = $(node).text().trim();
        if (text) {
          cleanText += `${text} `;
        }
      } else if (node.type === "tag") {
        const $node = $(node);
        const tagName = node.name;

        // Convert links to markdown format [Text](URL)
        if (tagName === "a") {
          const linkText = $node.text().trim();
          const linkHref = $node.attr("href");
          if (linkText && linkHref) {
            try {
              const absoluteUrl = new URL(linkHref, url).href;
              cleanText += `[${linkText}](${absoluteUrl}) `;
            } catch {
              cleanText += `${linkText} `;
            }
          }
          return; // Don't traverse into link children
        }

        // Add line breaks for block-level elements
        if (
          ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "br"].includes(
            tagName,
          )
        ) {
          traverse($node);
          cleanText += "\n\n";
        } else {
          traverse($node);
        }
      }
    });
  }

  traverse(body);

  // 5. Final Cleanup: Normalize whitespace and remove excessive newlines
  return cleanText
    .replace(/[ \t]+/g, " ") // Collapse multiple spaces/tabs
    .replace(/\n\s*\n/g, "\n\n") // Collapse multiple newlines
    .trim();
}
