import React, { useRef, useCallback, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";

interface TapOnlyDropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  contentAlign?: "start" | "center" | "end";
  contentClassName?: string;
  onContentClick?: (e: React.MouseEvent) => void;
}

const MOVE_THRESHOLD = 10; // pixels

const TapOnlyDropdown: React.FC<TapOnlyDropdownProps> = ({
  trigger,
  children,
  contentAlign = "start",
  contentClassName = "bg-popover",
  onContentClick,
}) => {
  const [open, setOpen] = useState(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const didScroll = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    didScroll.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
      didScroll.current = true;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!didScroll.current && touchStartPos.current) {
      e.preventDefault();
      setOpen(true);
    }
    touchStartPos.current = null;
  }, []);

  // Block all pointer/click events from Radix trigger on touch devices
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "touch") {
      e.preventDefault();
    }
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Allow mouse clicks (desktop) to work normally via Radix
    // Touch clicks are handled by touchEnd above
  }, []);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
        >
          {trigger}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={contentAlign}
        className={contentClassName}
        onClick={onContentClick}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TapOnlyDropdown;
