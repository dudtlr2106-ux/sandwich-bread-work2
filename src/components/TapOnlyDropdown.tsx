import React, { useRef, useCallback } from "react";
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

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (didScroll.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (didScroll.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onClick={handleClick}
          onPointerDown={handlePointerDown}
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
