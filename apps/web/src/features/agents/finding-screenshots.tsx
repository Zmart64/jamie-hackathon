import { useState } from "react";
import { Expand, ImageOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FindingScreenshot } from "./model";

export function FindingScreenshots({ screenshots }: { screenshots: FindingScreenshot[] }) {
  if (!screenshots.length) return null;
  return (
    <section aria-label="Success screenshots" className="space-y-3 border-t pt-5">
      <h4 className="text-sm font-medium">Success screenshots</h4>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {screenshots.map((screenshot) => (
          <SuccessScreenshot key={screenshot.src} screenshot={screenshot} />
        ))}
      </div>
    </section>
  );
}

function SuccessScreenshot({ screenshot }: { screenshot: FindingScreenshot }) {
  const [previewFailed, setPreviewFailed] = useState(false);
  return (
    <figure className="min-w-0 space-y-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="relative block h-auto w-full overflow-hidden p-0"
            aria-label={`Expand screenshot: ${screenshot.title}`}
          >
            <span className="absolute top-2 right-2 rounded-md border bg-background/90 p-1.5 text-muted-foreground shadow-xs">
              <Expand className="size-3.5" aria-hidden="true" />
            </span>
            <span className="flex aspect-[752/532] items-center justify-center bg-muted/40">
              {previewFailed ? (
                <span className="space-y-2 p-4 text-xs font-normal whitespace-normal text-muted-foreground">
                  <ImageOff className="mx-auto size-5" aria-hidden="true" />
                  <span className="block">Preview unavailable. Open to retry.</span>
                </span>
              ) : (
                <img
                  src={screenshot.src}
                  alt={screenshot.description}
                  width={752}
                  height={532}
                  className="block size-full object-contain"
                  onError={() => setPreviewFailed(true)}
                />
              )}
            </span>
          </Button>
        </DialogTrigger>
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[calc(100dvh-2rem)] min-w-0 gap-3 overflow-y-auto p-3 sm:max-w-[min(1000px,calc(100vw-3rem))] sm:p-5"
        >
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="text-base leading-snug">{screenshot.title}</DialogTitle>
          </DialogHeader>
          <ScreenshotDetail screenshot={screenshot} />
        </DialogContent>
      </Dialog>
      <figcaption className="text-sm font-medium">{screenshot.title}</figcaption>
    </figure>
  );
}

function ScreenshotDetail({ screenshot }: { screenshot: FindingScreenshot }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="grid justify-items-center gap-3 rounded-lg border bg-muted/40 p-8 text-center">
        <ImageOff className="size-6 text-muted-foreground" aria-hidden="true" />
        <p role="status" className="text-sm text-muted-foreground">
          Screenshot unavailable. The finding’s transcript and tool evidence remain available.
        </p>
        <Button variant="outline" size="sm" onClick={() => setFailed(false)}>
          <RotateCcw aria-hidden="true" />
          Retry screenshot
        </Button>
      </div>
    );
  }
  return (
    <img
      src={screenshot.src}
      alt={screenshot.description}
      width={752}
      height={532}
      className="max-h-[65dvh] w-full rounded-lg border bg-muted/40 object-contain"
      onError={() => setFailed(true)}
    />
  );
}
