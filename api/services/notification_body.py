"""Read passenger notice HTML into ordered text and link blocks."""

from urllib.parse import urljoin, urlsplit

from lxml import etree, html

from schemas.notification import NotificationBodyBlock

_IGNORED = {"script", "style", "noscript", "iframe", "template", "svg"}
_BOUNDARIES = {"p", "div", "article", "section", "ul", "ol", "table", "tr", "hr", "br"}
_HEADINGS = {"h1", "h2", "h3", "h4", "h5", "h6"}


def body_blocks(content: str, base_url: str) -> list[NotificationBodyBlock]:
    if not content.strip():
        return []
    root = html.fragment_fromstring(content, create_parent="div")
    result = []
    pending: list[str] = []

    def flush(kind: str) -> None:
        text = " ".join("".join(pending).split())
        pending.clear()
        if text:
            result.append(NotificationBodyBlock(type=kind, text=text))

    def visit(node: etree._Element, kind: str) -> None:
        tag = node.tag
        if not isinstance(tag, str) or tag in _IGNORED:
            return
        if tag == "a" and node.get("href"):
            try:
                href = urljoin(base_url, node.get("href").strip())
                parts = urlsplit(href)
            except ValueError:
                parts = None
            if parts and parts.scheme in {"https", "http"} and parts.netloc:
                label = (
                    " ".join(" ".join(node.itertext()).split())
                    or node.get("title")
                    or href
                )
                flush(kind)
                result.append(NotificationBodyBlock(type="link", text=label, href=href))
                return

        block = tag in _BOUNDARIES or tag in _HEADINGS or tag == "li"
        if block:
            flush(kind)
        child_kind = (
            "heading" if tag in _HEADINGS else "list_item" if tag == "li" else kind
        )
        if node.text:
            pending.append(node.text)
        if tag == "img" and node.get("alt"):
            pending.append(node.get("alt"))
        if tag == "td" and pending:
            pending.append(" ")
        for child in node:
            visit(child, child_kind)
            if child.tail:
                pending.append(child.tail)
        if block:
            flush(child_kind)

    visit(root, "paragraph")
    return result
