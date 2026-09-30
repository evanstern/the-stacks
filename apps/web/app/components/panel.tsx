import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";

export interface PanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  id?: string;
  children: ReactNode;
}

/**
 * The project's one slide-out panel (plan D7, FR-019, FR-020): right edge
 * on desktop, a bottom sheet under `narrow:` (CSS-only, no `matchMedia`).
 * Wraps shadcn `Sheet` once — every panel in the app goes through this.
 */
export function Panel({
  open,
  onOpenChange,
  title,
  description,
  id,
  children,
}: PanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        id={id}
        side="right"
        className="flex w-96 max-w-[90vw] flex-col border-l narrow:inset-x-0 narrow:top-auto narrow:bottom-0 narrow:h-[85dvh] narrow:w-full narrow:rounded-t-xl narrow:border-t narrow:border-l-0"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription className="sr-only">
              {description}
            </SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
