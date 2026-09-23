"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type DragEvent } from "react";
import { Check, Crop, FolderPlus, ImagePlus, Lock, MoreHorizontal, Sparkles, Star, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ACCEPTED_IMAGE_TYPES, processImage } from "@/lib/image-processing";
import type { ImageCrop } from "@/lib/slides/types";
import { CropDialog } from "./crop-dialog";
import {
  createLibrary,
  deleteAssets,
  describeMissingImages,
  deleteLibrary,
  findExistingAssets,
  linkAssets,
  registerAssets,
  renameLibrary,
  setAssetFlags,
  unlinkAssets,
  type NewAsset,
} from "./actions";

export type LibrarySummary = { id: string; name: string; count: number };
export type LibraryAsset = {
  id: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  favorite: boolean;
  locked: boolean;
  crop: ImageCrop | null;
  description: string | null;
};

type Props = {
  workspaceId: string;
  libraries: LibrarySummary[];
  selected: LibrarySummary | null;
  assets: LibraryAsset[];
  totalCount: number;
  undescribedCount: number;
};

const BATCH_SIZE = 4;

export function LibraryView({ workspaceId, libraries, selected, assets, totalCount, undescribedCount }: Props) {
  const router = useRouter();
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [cropping, setCropping] = useState<LibraryAsset | null>(null);
  const [describing, startDescribing] = useTransition();
  const [, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const run = (fn: () => Promise<unknown>, success?: string) =>
    startTransition(async () => {
      try {
        await fn();
        if (success) toast.success(success);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });

  async function uploadFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (images.length === 0) return;

    const supabase = createClient();
    const libraryId = selected?.id ?? null;
    let done = 0;
    let skipped = 0;
    let failed = 0;
    setUpload({ done, total: images.length });

    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE);
      const processed = await Promise.all(
        batch.map((file) =>
          processImage(file).catch((e) => {
            console.error(`Could not process ${file.name}`, e);
            return null;
          }),
        ),
      );
      const ok = processed.filter((p) => p !== null);
      failed += processed.length - ok.length;

      try {
        const existing = await findExistingAssets(ok.map((p) => p.sha256));
        const fresh = ok.filter((p) => !existing[p.sha256]);
        skipped += ok.length - fresh.length;

        const uploaded = await Promise.all(
          fresh.map(async (p): Promise<NewAsset> => {
            const id = crypto.randomUUID();
            const storagePath = `${workspaceId}/assets/${id}.jpg`;
            const thumbPath = `${workspaceId}/thumbs/${id}.jpg`;
            const bucket = supabase.storage.from("assets");
            const [full, thumb] = await Promise.all([
              bucket.upload(storagePath, p.full, { contentType: "image/jpeg" }),
              bucket.upload(thumbPath, p.thumb, { contentType: "image/jpeg" }),
            ]);
            if (full.error) throw full.error;
            if (thumb.error) throw thumb.error;
            return { id, storagePath, thumbPath, width: p.width, height: p.height, sha256: p.sha256 };
          }),
        );
        await registerAssets(uploaded, Object.values(existing), libraryId);
      } catch (e) {
        console.error(e);
        failed += ok.length;
      }

      done += batch.length;
      setUpload({ done, total: images.length });
    }

    setUpload(null);
    router.refresh();
    const added = images.length - skipped - failed;
    toast[failed ? "error" : "success"](
      [
        added && `${added} image${added === 1 ? "" : "s"} added`,
        skipped && `${skipped} already in the workspace${libraryId ? " (linked here)" : ""}`,
        failed && `${failed} failed`,
      ]
        .filter(Boolean)
        .join(" · "),
    );
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void uploadFiles([...e.dataTransfer.files]);
  }

  function toggle(id: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedIds = [...selection];
  const otherLibraries = libraries.filter((lib) => lib.id !== selected?.id);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <LibraryList libraries={libraries} selectedId={selected?.id ?? null} totalCount={totalCount} />

      <section
        className={cn("panel min-h-[480px] p-5 transition-shadow", dragging && "glow")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
          <LibraryTitle
            library={selected}
            onRename={(name) => run(() => renameLibrary(selected!.id, name))}
            onDelete={() => {
              if (!selected) return;
              if (confirm(`Delete library "${selected.name}"? The images stay in "All images".`)) {
                run(async () => {
                  await deleteLibrary(selected.id);
                  router.push("/library");
                }, "Library deleted");
              }
            }}
          />
          <div className="flex items-center gap-2">
            {undescribedCount > 0 && !upload && (
              <Button
                variant="outline"
                disabled={describing}
                title="The AI looks at each image once, so campaigns can pick photos that fit the slide text"
                onClick={() =>
                  startDescribing(async () => {
                    const n = await describeMissingImages();
                    toast.success(`${n} image${n === 1 ? "" : "s"} analysed`);
                    router.refresh();
                  })
                }
              >
                <Sparkles className={cn(describing && "animate-pulse")} />
                {describing ? "Analysing…" : `Analyse ${undescribedCount} image${undescribedCount === 1 ? "" : "s"} for AI matching`}
              </Button>
            )}
            {upload && (
              <span className="text-sm text-muted-foreground tabular-nums">
                Uploading {upload.done}/{upload.total}…
              </span>
            )}
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              multiple
              hidden
              onChange={(e) => {
                void uploadFiles([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
            <Button onClick={() => fileInput.current?.click()} disabled={!!upload} className="glow-hover">
              <Upload /> Upload
            </Button>
          </div>
        </div>

        {selection.size > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-sm">
            <span className="pr-2 tabular-nums">{selection.size} selected</span>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                <FolderPlus /> Add to library
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {otherLibraries.length === 0 && <DropdownMenuItem disabled>No other libraries</DropdownMenuItem>}
                {otherLibraries.map((lib) => (
                  <DropdownMenuItem
                    key={lib.id}
                    onClick={() =>
                      run(async () => {
                        await linkAssets(selectedIds, lib.id);
                        setSelection(new Set());
                      }, `Added to ${lib.name}`)
                    }
                  >
                    {lib.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {selected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  run(async () => {
                    await unlinkAssets(selectedIds, selected.id);
                    setSelection(new Set());
                  }, "Removed from library")
                }
              >
                <X /> Remove from library
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm(`Delete ${selection.size} image(s) everywhere? This cannot be undone.`)) {
                  run(async () => {
                    await deleteAssets(selectedIds);
                    setSelection(new Set());
                  }, "Images deleted");
                }
              }}
            >
              <Trash2 /> Delete
            </Button>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelection(new Set())}>
              Clear
            </Button>
          </div>
        )}

        {assets.length === 0 ? (
          <button
            onClick={() => fileInput.current?.click()}
            className="flex h-80 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <ImagePlus className="size-6" />
            Drop images here or click to upload
            <span className="text-xs">JPG, PNG, WEBP, HEIC</span>
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
            {assets.map((asset) => (
              <AssetTile
                key={asset.id}
                asset={asset}
                selected={selection.has(asset.id)}
                onToggle={() => toggle(asset.id)}
                onFlag={(flags) => run(() => setAssetFlags(asset.id, flags))}
                onCrop={() => setCropping(asset)}
              />
            ))}
          </div>
        )}
      </section>

      {cropping?.thumbUrl && (
        <CropDialog
          asset={{ id: cropping.id, thumbUrl: cropping.thumbUrl, crop: cropping.crop }}
          onClose={() => {
            setCropping(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function LibraryList({
  libraries,
  selectedId,
  totalCount,
}: {
  libraries: LibrarySummary[];
  selectedId: string | null;
  totalCount: number;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const item = (href: string, label: string, count: number, active: boolean) => (
    <Link
      key={href}
      href={href}
      className={cn(
        "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors",
        active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs tabular-nums">{count}</span>
    </Link>
  );

  return (
    <aside className="space-y-1">
      {item("/library", "All images", totalCount, selectedId === null)}
      <div className="px-2.5 pt-4 pb-1 text-xs font-medium tracking-widest text-muted-foreground">LIBRARIES</div>
      {libraries.map((lib) => item(`/library?l=${lib.id}`, lib.name, lib.count, lib.id === selectedId))}
      <form
        className="pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          startTransition(async () => {
            const id = await createLibrary(name);
            setName("");
            router.push(`/library?l=${id}`);
          });
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="+ New library"
          disabled={pending}
          className="h-8"
        />
      </form>
    </aside>
  );
}

function LibraryTitle({
  library,
  onRename,
  onDelete,
}: {
  library: LibrarySummary | null;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (!library) return <h2 className="font-medium">All images</h2>;

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
          if (name && name !== library.name) onRename(name);
          setEditing(false);
        }}
      >
        <Input name="name" defaultValue={library.name} autoFocus onBlur={(e) => e.currentTarget.form?.requestSubmit()} className="h-8 w-64" />
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <h2 className="font-medium">{library.name}</h2>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Library options" />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setEditing(true)}>Rename</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            Delete library
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function AssetTile({
  asset,
  selected,
  onToggle,
  onFlag,
  onCrop,
}: {
  asset: LibraryAsset;
  selected: boolean;
  onToggle: () => void;
  onFlag: (flags: { favorite?: boolean; locked?: boolean }) => void;
  onCrop: () => void;
}) {
  const crop = asset.crop ?? { zoom: 1, x: 0, y: 0 };
  return (
    <div
      title={asset.description ?? undefined}
      className={cn(
        "group relative aspect-[9/16] overflow-hidden rounded-xl border border-border bg-secondary",
        selected && "glow",
        asset.locked && "opacity-50",
      )}
    >
      {asset.thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URLs, already resized thumbnails
        <img
          src={asset.thumbUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          style={{ transform: `translate(${crop.x * 100}%, ${crop.y * 100}%) scale(${crop.zoom})` }}
          onClick={onToggle}
        />
      )}

      <button
        onClick={onToggle}
        aria-label={selected ? "Deselect" : "Select"}
        className={cn(
          "absolute top-2 left-2 flex size-5 items-center justify-center rounded-md border transition-opacity",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-white/60 bg-black/40 opacity-0 group-hover:opacity-100",
        )}
      >
        {selected && <Check className="size-3.5" />}
      </button>

      <div className="absolute right-2 bottom-2 flex gap-1">
        <FlagButton active={!!asset.crop} label="Adjust framing for 9:16 slides" onClick={onCrop}>
          <Crop className="size-3.5" />
        </FlagButton>
        <FlagButton
          active={asset.favorite}
          label={asset.favorite ? "Unfavorite" : "Favorite: used more often"}
          onClick={() => onFlag({ favorite: !asset.favorite })}
        >
          <Star className={cn("size-3.5", asset.favorite && "fill-current")} />
        </FlagButton>
        <FlagButton
          active={asset.locked}
          label={asset.locked ? "Unlock" : "Lock: never used in posts"}
          onClick={() => onFlag({ locked: !asset.locked })}
        >
          <Lock className="size-3.5" />
        </FlagButton>
      </div>
    </div>
  );
}

function FlagButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex size-6 items-center justify-center rounded-md bg-black/50 backdrop-blur transition-opacity",
        active ? "text-primary opacity-100" : "text-white opacity-0 group-hover:opacity-100",
      )}
    >
      {children}
    </button>
  );
}
