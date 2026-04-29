import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download } from "lucide-react";

interface AttachmentRow {
  id: string;
  storage_path: string;
  mime_type: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
}

export function Attachment({ att }: { att: AttachmentRow }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = att.mime_type?.startsWith("image/");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.storage
        .from("attachments")
        .createSignedUrl(att.storage_path, 60 * 60);
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [att.storage_path]);

  if (!url) {
    return <div className="mt-1 h-10 w-40 animate-pulse rounded bg-muted" />;
  }

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1 block max-w-sm overflow-hidden rounded-md border border-border">
        <img src={url} alt="attachment" className="max-h-80 w-auto" />
      </a>
    );
  }

  const filename = att.storage_path.split("/").pop() ?? "file";
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-1 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent"
    >
      <FileText className="h-4 w-4 text-muted-foreground" />
      <span className="max-w-[200px] truncate">{filename}</span>
      {att.size != null && <span className="text-xs text-muted-foreground">{formatSize(att.size)}</span>}
      <Download className="h-3.5 w-3.5 text-muted-foreground" />
    </a>
  );
}

function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
