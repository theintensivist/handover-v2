/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface MarkdownViewProps {
  content: string;
}

/**
 * A highly resilient, lightweight regex Markdown parser designed to render styled
 * medical summaries, bullet lists, and clinical tables without third-party library bloat.
 */
export default function MarkdownView({ content }: MarkdownViewProps) {
  if (!content) return null;

  // Split content by lines and parse basic markdown features
  const lines = content.split("\n");

  const renderedLines = lines.map((line, idx) => {
    const trimmed = line.trim();

    // 1. Headers (### or ## or #)
    if (trimmed.startsWith("### ")) {
      return (
        <h4 key={idx} className="text-sm font-bold text-zinc-100 tracking-wide mt-5 mb-2 border-l-2 border-emerald-500 pl-2">
          {parseInline(trimmed.substring(4))}
        </h4>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <h3 key={idx} className="text-base font-serif italic text-emerald-500 tracking-tight mt-6 mb-3 border-b border-[#222222] pb-1">
          {parseInline(trimmed.substring(3))}
        </h3>
      );
    }
    if (trimmed.startsWith("# ")) {
      return (
        <h2 key={idx} className="text-lg font-serif font-black text-zinc-100 tracking-tight mt-8 mb-4 border-b border-[#222222] pb-1.5 uppercase">
          {parseInline(trimmed.substring(2))}
        </h2>
      );
    }

    // 2. Horizontal Rule
    if (trimmed === "---" || trimmed === "***") {
      return <hr key={idx} className="my-6 border-[#222222]" />;
    }

    // 3. Bullet Lists
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const itemText = trimmed.substring(2);
      return (
        <li key={idx} className="ml-5 list-disc text-xs text-zinc-300 leading-relaxed mb-1.5">
          {parseInline(itemText)}
        </li>
      );
    }

    // 4. Numbered Lists
    const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
    if (numMatch) {
      const text = numMatch[2];
      return (
        <li key={idx} className="ml-5 list-decimal text-xs text-zinc-300 leading-relaxed mb-1.5">
          {parseInline(text)}
        </li>
      );
    }

    // 5. Empty Lines
    if (!trimmed) {
      return <div key={idx} className="h-2" />;
    }

    // 6. Normal Paragraph
    return (
      <p key={idx} className="text-xs text-zinc-300 leading-relaxed mb-3 font-sans">
        {parseInline(line)}
      </p>
    );
  });

  return (
    <div className="space-y-1 text-zinc-200 select-text font-sans">
      {renderedLines}
    </div>
  );
}

// Simple parser for bold (**text**), italics (*text*), and code (`text`)
function parseInline(text: string): React.ReactNode[] {
  let currentText = text;

  // Pattern matching
  // We look for **bold** or `code`
  const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g;
  const matchParts = currentText.split(regex);

  return matchParts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-zinc-150">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="bg-[#1A1A1A] px-1.5 py-0.5 rounded text-[11px] font-mono border border-[#222222] text-emerald-400">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i} className="italic text-zinc-400">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
