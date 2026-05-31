import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { Link } from "react-router";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "~/lib/utils";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedHighlightTerms(terms: string[]): string[] {
  return Array.from(new Set(terms.map((term) => term.trim()).filter((term) => term.length >= 2)));
}

function citationLinkForOrdinal(ordinal: number, citationLinks: Record<number, string>): string | null {
  return citationLinks[ordinal] ?? null;
}

function highlightedText(text: string, terms: string[], citationLinks: Record<number, string>): ReactNode {
  const termAlternation = terms.map(escapeRegExp).join("|");
  const combinedPattern = new RegExp(`(\\[\\d+\\]${termAlternation ? `|${termAlternation}` : ""})`, "gi");
  const termPattern = termAlternation ? new RegExp(`^(?:${termAlternation})$`, "i") : null;
  const parts = text.split(combinedPattern).filter((part) => part.length > 0);

  return parts.map((part, index) => {
    const citationOrdinal = /^\[(\d+)\]$/.exec(part)?.[1];

    if (citationOrdinal) {
      const ordinal = Number(citationOrdinal);
      const href = citationLinkForOrdinal(ordinal, citationLinks);

      return href
        ? <Link key={`${part}-${index}`} className="citation-ref" data-testid="inline-citation-link" to={href}>{part}</Link>
        : part;
    }

    if (termPattern?.test(part)) {
      return <mark key={`${part}-${index}`} className="source-highlight">{part}</mark>;
    }

    return part;
  });
}

function highlightedChildren(children: ReactNode, terms: string[], citationLinks: Record<number, string>): ReactNode {
  if (typeof children === "string") {
    return highlightedText(children, terms, citationLinks);
  }

  return Children.map(children, (child) => {
    if (typeof child === "string") {
      return highlightedText(child, terms, citationLinks);
    }

    if (isValidElement<{ children?: ReactNode }>(child)) {
      const element = child as ReactElement<{ children?: ReactNode }>;
      return cloneElement(element, undefined, highlightedChildren(element.props.children, terms, citationLinks));
    }

    return child;
  });
}

function markdownComponents(terms: string[], citationLinks: Record<number, string>): Components {
  return {
    a({ children, ...props }) {
      return <a {...props}>{highlightedChildren(children, terms, citationLinks)}</a>;
    },
    blockquote({ children, ...props }) {
      return <blockquote {...props}>{highlightedChildren(children, terms, citationLinks)}</blockquote>;
    },
    em({ children, ...props }) {
      return <em {...props}>{highlightedChildren(children, terms, citationLinks)}</em>;
    },
    h1({ children, ...props }) {
      return <h1 {...props}>{highlightedChildren(children, terms, citationLinks)}</h1>;
    },
    h2({ children, ...props }) {
      return <h2 {...props}>{highlightedChildren(children, terms, citationLinks)}</h2>;
    },
    h3({ children, ...props }) {
      return <h3 {...props}>{highlightedChildren(children, terms, citationLinks)}</h3>;
    },
    h4({ children, ...props }) {
      return <h4 {...props}>{highlightedChildren(children, terms, citationLinks)}</h4>;
    },
    h5({ children, ...props }) {
      return <h5 {...props}>{highlightedChildren(children, terms, citationLinks)}</h5>;
    },
    h6({ children, ...props }) {
      return <h6 {...props}>{highlightedChildren(children, terms, citationLinks)}</h6>;
    },
    li({ children, ...props }) {
      return <li {...props}>{highlightedChildren(children, terms, citationLinks)}</li>;
    },
    p({ children, ...props }) {
      return <p {...props}>{highlightedChildren(children, terms, citationLinks)}</p>;
    },
    strong({ children, ...props }) {
      return <strong {...props}>{highlightedChildren(children, terms, citationLinks)}</strong>;
    },
    td({ children, ...props }) {
      return <td {...props}>{highlightedChildren(children, terms, citationLinks)}</td>;
    },
    th({ children, ...props }) {
      return <th {...props}>{highlightedChildren(children, terms, citationLinks)}</th>;
    },
  };
}

export function MarkdownContent({ children, citationLinks = {}, className, highlightTerms = [] }: { children: string; citationLinks?: Record<number, string>; className?: string; highlightTerms?: string[] }) {
  const terms = normalizedHighlightTerms(highlightTerms);

  return (
    <div className={cn("markdown-content", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents(terms, citationLinks)}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
