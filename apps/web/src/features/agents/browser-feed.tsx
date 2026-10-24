import { useEffect, useRef, useState } from "react";
import { Expand } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { browserFeeds, type BrowserFeedId } from "./demo";

function syncVideo(video: HTMLVideoElement, id: BrowserFeedId, elapsed: number) {
  if (!Number.isFinite(video.duration) || video.duration <= 0) return;
  const feed = browserFeeds[id];
  const fraction = Math.max(0, Math.min(1, (elapsed - feed.start) / (feed.end - feed.start)));
  const target = Math.min(fraction * video.duration, video.duration - 0.05);
  if (Math.abs(video.currentTime - target) > 0.25) video.currentTime = target;
  if (fraction >= 1) {
    video.pause();
    return;
  }
  video.playbackRate = Math.max(
    0.25,
    Math.min(4, video.duration / ((feed.end - feed.start) / 1000)),
  );
  if (video.paused) return video.play();
}

export function BrowserVideo({ id, elapsedMs }: { id: BrowserFeedId; elapsedMs: number }) {
  const video = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!loaded || !video.current || failed) return;
    const playback = syncVideo(video.current, id, elapsedMs);
    playback?.catch(() => setFailed(true));
  }, [id, elapsedMs, loaded, failed]);
  return (
    <span className="relative block aspect-[752/532] overflow-hidden bg-muted">
      <video
        ref={video}
        src={`/demo/carbon-zero/${id}.webm`}
        poster={`/demo/carbon-zero/${id}.png`}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        className="pointer-events-none block size-full object-contain"
        aria-label={`${browserFeeds[id].title} browser feed`}
        onLoadedMetadata={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
      {failed && (
        <span
          role="status"
          className="absolute inset-x-0 bottom-0 bg-background/95 p-3 text-center text-xs text-muted-foreground"
        >
          Browser feed unavailable. The assessment continues.
        </span>
      )}
    </span>
  );
}

export function BrowserFeed({ id, elapsedMs }: { id: BrowserFeedId; elapsedMs: number }) {
  const feed = browserFeeds[id];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="nodrag nopan nowheel group block h-[180px] w-full overflow-hidden rounded-lg p-0 shadow-sm"
          aria-label={`Expand browser: ${feed.title}`}
        >
          <span className="flex h-6 items-center gap-1.5 border-b bg-card px-2 text-[10px] font-normal text-muted-foreground">
            <img
              src="/brand/google-chrome.svg"
              alt=""
              className="size-3 shrink-0"
              aria-hidden="true"
            />
            <span className="truncate">{feed.title}</span>
            <Expand className="ml-auto size-3 shrink-0" aria-hidden="true" />
          </span>
          <span className="block h-[154px] overflow-hidden [&>span]:h-full [&>span]:aspect-auto">
            <BrowserVideo id={id} elapsedMs={elapsedMs} />
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[calc(100dvh-2rem)] gap-3 overflow-y-auto p-3 sm:max-w-[min(1000px,calc(100vw-3rem))] sm:p-5"
      >
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="text-base">{feed.title}</DialogTitle>
        </DialogHeader>
        <div className="overflow-hidden rounded-lg border [&>span]:max-h-[min(70dvh,calc(100dvh-11rem))]">
          <BrowserVideo id={id} elapsedMs={elapsedMs} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
