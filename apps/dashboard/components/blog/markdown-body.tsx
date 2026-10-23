import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { isInternalLink } from "@/lib/validations/announcement";

/**
 * How each part of a post is drawn. A `#` heading in the body becomes a second-level heading, because the post's own
 * title is the page's one first-level heading.
 */
const components: Components = {
  h1: ({ children }) => <h2 className="mt-12 text-3xl font-medium sm:text-4xl">{children}</h2>,
  h2: ({ children }) => <h2 className="mt-12 text-3xl font-medium sm:text-4xl">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-10 text-2xl font-medium">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-8 text-xl font-medium">{children}</h4>,
  p: ({ children }) => <p className="mt-5 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mt-5 list-disc space-y-2 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="mt-5 list-decimal space-y-2 pl-6">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => <blockquote className="mt-6 border-l-4 border-brand pl-5 font-accent text-xl italic">{children}</blockquote>,
  hr: () => <hr className="my-10" />,
  a: ({ href, children }) => {
    const className = "text-brand underline underline-offset-4 hover:opacity-80";
    if (!href) return <span>{children}</span>;
    return isInternalLink(href) ? (
      <Link href={href} className={className}>
        {children}
      </Link>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  },
  // The writer's own alt text is passed through
  img: ({ src, alt }) => (typeof src === "string" ? <img src={src} alt={alt ?? ""} loading="lazy" className="mt-6 w-full rounded-card border" /> : null),
  pre: ({ children }) => <pre className="mt-6 overflow-x-auto rounded-card bg-surface-inverse p-4 text-sm text-text-inverse">{children}</pre>,
  code: ({ children, className }) => (
    <code className={className ?? "rounded-control bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.9em]"}>{children}</code>
  ),
  table: ({ children }) => (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b px-3 py-2 font-medium">{children}</th>,
  td: ({ children }) => <td className="border-b px-3 py-2">{children}</td>,
};

/**
 * A post's Markdown as styled HTML. Raw HTML in the text is not rendered (react-markdown leaves it out) and links with
 * unsafe addresses are dropped, so what an admin pastes cannot run script on the page. Used for the public post and
 * for the admin's preview.
 */
export function MarkdownBody({ source }: { source: string }) {
  return (
    <div className="text-text-muted [&>:first-child]:mt-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
