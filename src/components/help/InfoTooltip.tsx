import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface InfoTooltipProps {
  /** The help text to display */
  content: string;
  /** Optional title for the tooltip */
  title?: string;
  /** Side where the popover appears */
  side?: "top" | "right" | "bottom" | "left";
  /** Alignment of the popover */
  align?: "start" | "center" | "end";
  /** Additional class name for the trigger button */
  className?: string;
  /** Size of the info icon */
  size?: "sm" | "md";
}

/**
 * InfoTooltip - A small "i" icon that shows help text on click.
 *
 * Uses Popover (click-based) instead of Tooltip (hover-based) for better
 * touch/mobile support.
 *
 * @example
 * <InfoTooltip content="Das Hauptkeyword für SEO-Optimierung" />
 *
 * @example
 * <Label>
 *   Primary Keyword <InfoTooltip content={HELP_CONTENT.briefs.primaryKeyword} />
 * </Label>
 */
export function InfoTooltip({
  content,
  title,
  side = "top",
  align = "center",
  className,
  size = "sm",
}: InfoTooltipProps) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const buttonSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded-full",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "transition-colors cursor-help ml-1",
            buttonSize,
            className
          )}
          aria-label="Mehr Informationen"
        >
          <Info className={iconSize} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="w-64 text-sm"
      >
        {title && (
          <p className="font-medium mb-1">{title}</p>
        )}
        <p className="text-muted-foreground">{content}</p>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Inline variant that fits better with form labels
 */
export function InfoTooltipInline({
  content,
  title,
  side = "top",
  align = "center",
}: Omit<InfoTooltipProps, "className" | "size">) {
  return (
    <InfoTooltip
      content={content}
      title={title}
      side={side}
      align={align}
      size="sm"
      className="align-middle -mt-0.5"
    />
  );
}
