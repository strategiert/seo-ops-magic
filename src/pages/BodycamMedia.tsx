import { useQuery, useAction, useMutation, useConvexAuth } from "convex/react";
import { Upload, Copy, Trash2, Image, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { api } from "../../convex/_generated/api";
import { useState, useRef } from "react";
import type { Id } from "../../convex/_generated/dataModel";

export default function BodycamMedia() {
  const { toast } = useToast();
  const { isAuthenticated } = useConvexAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");

  const media = useQuery(api.tables.bodycam.listMedia, isAuthenticated ? {} : "skip");
  const uploadMedia = useAction(api.actions.bodycam.uploadMedia);
  const deleteMedia = useMutation(api.tables.bodycam.deleteMedia);
  const updateAlt = useMutation(api.tables.bodycam.updateMediaAlt);

  const filtered = media?.filter((m) =>
    !search || m.filename.toLowerCase().includes(search.toLowerCase()) || m.alt?.toLowerCase().includes(search.toLowerCase())
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    let success = 0;
    let failed = 0;

    for (const file of files) {
      try {
        // Datei als Base64 einlesen
        const base64 = await fileToBase64(file);
        await uploadMedia({
          filename: file.name,
          contentBase64: base64,
          mimeType: file.type || "application/octet-stream",
          alt: "",
        });
        success++;
      } catch (err: any) {
        failed++;
        console.error(err);
      }
    }

    setUploading(false);
    if (success > 0) {
      toast({
        title: `${success} Bild${success > 1 ? "er" : ""} hochgeladen`,
        description: failed > 0 ? `${failed} fehlgeschlagen.` : undefined,
      });
    } else {
      toast({ title: "Upload fehlgeschlagen", description: "Bitte R2-Zugangsdaten prüfen.", variant: "destructive" });
    }

    // File input zurücksetzen
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "URL kopiert", description: url });
  };

  const handleDelete = async (id: Id<"bodycamMedia">, filename: string) => {
    if (!confirm(`Eintrag "${filename}" löschen? (R2-Datei bleibt erhalten)`)) return;
    await deleteMedia({ id });
    toast({ title: "Gelöscht", description: filename });
  };

  const handleAltChange = async (id: Id<"bodycamMedia">, alt: string) => {
    await updateAlt({ id, alt });
  };

  return (
    <AppLayout
      title="Bilder"
      breadcrumbs={[
        { label: "Bodycam", href: "/bodycam" },
        { label: "Bilder" },
      ]}
    >
      <div className="space-y-4">
        {/* Upload + Suche */}
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <div className="flex-1" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-[#003366] hover:bg-[#002244] text-white"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Bild hochladen
          </Button>
        </div>

        {/* R2 Hinweis */}
        {media?.length === 0 && (
          <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
            <Image className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Noch keine Bilder</p>
            <p className="mt-1 text-xs">
              R2 Bucket "netco-bodycam-media" muss eingerichtet sein.
              <br />
              Dann R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY in Convex Environment Variables setzen.
            </p>
          </div>
        )}

        {/* Media Grid */}
        {filtered && filtered.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map((item) => (
              <MediaCard
                key={item._id}
                item={item}
                onCopy={() => handleCopyUrl(item.url)}
                onDelete={() => handleDelete(item._id as Id<"bodycamMedia">, item.filename)}
                onAltChange={(alt) => handleAltChange(item._id as Id<"bodycamMedia">, alt)}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ── Media Card ────────────────────────────────────────────────────────────────

function MediaCard({
  item,
  onCopy,
  onDelete,
  onAltChange,
}: {
  item: any;
  onCopy: () => void;
  onDelete: () => void;
  onAltChange: (alt: string) => void;
}) {
  const [editingAlt, setEditingAlt] = useState(false);
  const [altValue, setAltValue] = useState(item.alt ?? "");

  const isImage = item.mimeType?.startsWith("image/");
  const sizeKb = Math.round(item.sizeBytes / 1024);

  return (
    <div className="border rounded-lg overflow-hidden group">
      {/* Preview */}
      <div className="aspect-square bg-muted relative">
        {isImage ? (
          <img
            src={item.url}
            alt={item.alt ?? item.filename}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Image className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}

        {/* Overlay Actions */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={onCopy}
            className="p-1.5 bg-white/90 rounded-md hover:bg-white transition-colors"
            title="URL kopieren"
          >
            <Copy className="h-3.5 w-3.5 text-gray-700" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 bg-white/90 rounded-md hover:bg-white transition-colors"
            title="Löschen"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="p-2 space-y-1">
        <p className="text-xs font-mono truncate text-muted-foreground" title={item.filename}>
          {item.filename}
        </p>
        <p className="text-xs text-muted-foreground">{sizeKb} KB</p>

        {/* Alt Text */}
        {editingAlt ? (
          <input
            autoFocus
            value={altValue}
            onChange={(e) => setAltValue(e.target.value)}
            onBlur={() => {
              onAltChange(altValue);
              setEditingAlt(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onAltChange(altValue);
                setEditingAlt(false);
              }
            }}
            className="text-xs w-full border rounded px-1 py-0.5"
            placeholder="Alt-Text..."
          />
        ) : (
          <p
            className="text-xs text-muted-foreground/70 truncate cursor-pointer hover:text-foreground"
            onClick={() => setEditingAlt(true)}
            title="Klicken zum Bearbeiten"
          >
            {item.alt || <span className="italic">Alt-Text...</span>}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Entferne "data:image/jpeg;base64," Prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
