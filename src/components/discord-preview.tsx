import { Hash, Link2 } from "lucide-react";

import { discordTime, renderMarkdown } from "@/lib/format";
import type { DiscordEmbed, EmbedButton } from "@/lib/types";

interface PreviewProps {
  botName: string;
  botAvatar: string;
  channelName?: string;
  kind: "message" | "embed";
  content: string;
  embed: DiscordEmbed;
  buttons?: EmbedButton[];
  attachments?: string[];
  timestamp?: string | null;
  className?: string;
}

function Md({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={`dc-md ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  );
}

const buttonStyles: Record<EmbedButton["style"], string> = {
  primary: "bg-blurple text-white hover:brightness-110",
  secondary: "bg-dc-input text-dc-text hover:brightness-110",
  success: "bg-success text-black hover:brightness-110",
  danger: "bg-destructive text-white hover:brightness-110",
  link: "bg-dc-input text-dc-text hover:brightness-110",
};

export function DiscordPreview({
  botName,
  botAvatar,
  channelName,
  kind,
  content,
  embed,
  buttons = [],
  attachments = [],
  timestamp,
  className,
}: PreviewProps) {
  const hasEmbed =
    kind === "embed" &&
    Boolean(
      embed.title ||
        embed.description ||
        embed.authorName ||
        embed.image ||
        embed.thumbnail ||
        embed.footerText ||
        embed.fields.length,
    );

  return (
    <div
      className={`overflow-hidden rounded-xl border border-black/30 bg-dc-chat font-sans text-dc-text shadow-xl ${className ?? ""}`}
    >
      {channelName && (
        <div className="flex items-center gap-2 border-b border-black/30 px-4 py-2.5 text-sm font-semibold">
          <Hash className="h-4 w-4 text-dc-muted" />
          <span>{channelName}</span>
        </div>
      )}

      <div className="flex gap-4 px-4 py-4">
        <img
          src={botAvatar}
          alt=""
          className="h-10 w-10 shrink-0 rounded-full bg-dc-embed object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.95rem] font-medium text-dc-text">{botName}</span>
            <span className="rounded bg-blurple px-1 py-px text-[0.625rem] font-semibold uppercase leading-4 tracking-wide text-white">
              Bot
            </span>
            <span className="text-[0.6875rem] text-dc-muted">{discordTime(timestamp ?? null)}</span>
          </div>

          {content.trim() && (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-[0.9375rem] leading-[1.375rem]">
              <Md text={content} />
            </p>
          )}

          {hasEmbed && (
            <div className="mt-2 max-w-[520px] overflow-hidden rounded">
              <div className="flex" style={{ backgroundColor: embed.color }}>
                <div className="w-1 shrink-0" />
                <div className="flex-1 rounded-r bg-dc-embed p-3">
                  <div className="flex gap-3">
                    <div className="min-w-0 flex-1">
                      {embed.authorName && (
                        <div className="mb-2 flex items-center gap-2">
                          {embed.authorIcon && (
                            <img src={embed.authorIcon} alt="" className="h-6 w-6 rounded-full" />
                          )}
                          <span className="text-[0.875rem] font-semibold">{embed.authorName}</span>
                        </div>
                      )}
                      {embed.title && (
                        <div className="mb-2 text-base font-semibold leading-snug">
                          {embed.titleUrl ? (
                            <a
                              href={embed.titleUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-dc-link hover:underline"
                            >
                              {embed.title}
                            </a>
                          ) : (
                            embed.title
                          )}
                        </div>
                      )}
                      {embed.description && (
                        <p className="whitespace-pre-wrap break-words text-[0.875rem] leading-[1.125rem] text-dc-text/90">
                          <Md text={embed.description} />
                        </p>
                      )}

                      {embed.fields.length > 0 && (
                        <div className="mt-2 grid grid-cols-6 gap-2">
                          {embed.fields.map((f) => (
                            <div
                              key={f.id}
                              className={f.inline ? "col-span-2 min-w-0" : "col-span-6 min-w-0"}
                            >
                              <div className="text-[0.875rem] font-semibold">{f.name}</div>
                              <div className="whitespace-pre-wrap break-words text-[0.875rem] leading-[1.125rem] text-dc-text/90">
                                <Md text={f.value} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {embed.thumbnail && (
                      <img
                        src={embed.thumbnail}
                        alt=""
                        className="h-20 w-20 shrink-0 rounded object-cover"
                      />
                    )}
                  </div>

                  {embed.image && (
                    <img
                      src={embed.image}
                      alt=""
                      className="mt-3 w-full rounded object-cover"
                      style={{ maxHeight: 300 }}
                    />
                  )}

                  {(embed.footerText || embed.showTimestamp) && (
                    <div className="mt-2 flex items-center gap-2 text-[0.75rem] text-dc-muted">
                      {embed.footerIcon && (
                        <img src={embed.footerIcon} alt="" className="h-5 w-5 rounded-full" />
                      )}
                      <span>
                        {embed.footerText}
                        {embed.footerText && embed.showTimestamp ? " • " : ""}
                        {embed.showTimestamp
                          ? new Date(timestamp ?? Date.now()).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="mt-2 flex max-w-[520px] flex-wrap gap-2">
              {attachments.map((a) => (
                <img key={a} src={a} alt="" className="h-28 rounded-lg object-cover" />
              ))}
            </div>
          )}

          {buttons.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {buttons.map((b) => (
                <a
                  key={b.id}
                  href={b.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center gap-1.5 rounded px-4 py-2 text-[0.875rem] font-medium transition ${buttonStyles[b.style]}`}
                >
                  {b.label || "Button"}
                  {b.style === "link" && <Link2 className="h-3.5 w-3.5 opacity-70" />}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
