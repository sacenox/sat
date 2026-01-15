import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="scroll-m-20 text-2xl font-extrabold tracking-tight lg:text-3xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="scroll-m-20 border-b pb-2 text-xl font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="scroll-m-20 text-lg font-semibold tracking-tight">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="scroll-m-20 text-base font-semibold tracking-tight">
      {children}
    </h4>
  ),
  p: ({ children }) => <p className="leading-7 not-first:mt-4">{children}</p>,
  blockquote: ({ children }) => (
    <blockquote className="mt-4 border-l-2 pl-6 italic">{children}</blockquote>
  ),
  ul: ({ children }) => (
    <ul className="my-4 ml-6 list-disc [&>li]:mt-2">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-4 ml-6 list-decimal [&>li]:mt-2">{children}</ol>
  ),
  code: ({ children }) => (
    <code className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="bg-muted mt-4 overflow-x-auto rounded-lg p-4 font-mono text-sm">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-4 hover:no-underline"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-4 w-full overflow-y-auto">
      <table className="w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border px-4 py-2 text-left font-bold">{children}</th>
  ),
  td: ({ children }) => <td className="border px-4 py-2">{children}</td>,
  hr: () => <hr className="my-8 border-t" />,
};

export const MarkdownContent = memo(function MarkdownContent({
  content,
}: {
  content: string;
}) {
  return <ReactMarkdown components={components}>{content}</ReactMarkdown>;
});
