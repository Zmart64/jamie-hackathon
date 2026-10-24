import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CanvasDetails({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus({ preventScroll: true });
  }, []);
  return (
    <Card
      role="complementary"
      aria-labelledby={titleId}
      className="absolute inset-y-0 right-0 z-20 h-full w-full max-w-[360px] gap-0 overflow-hidden rounded-none border-0 border-l py-0 shadow-none lg:static lg:shrink-0"
    >
      <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2 border-b px-4 py-3">
        <CardTitle className="text-sm">
          <h2 id={titleId}>Step details</h2>
        </CardTitle>
        <Button
          ref={closeButton}
          variant="ghost"
          size="icon-sm"
          aria-label="Close step details"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {children}
      </CardContent>
    </Card>
  );
}
