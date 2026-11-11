import { useState, useEffect, useRef, useCallback } from "react";

export interface MobileKeyboardViewportState {
  /** Current available viewport height in px (from visualViewport or innerHeight) */
  viewportHeight: number;
  /** Current available viewport width in px */
  viewportWidth: number;
  /** True when a virtual keyboard is detected on a mobile screen */
  isKeyboardOpen: boolean;
  /** Approximate height in px of the virtual keyboard */
  keyboardHeight: number;
  /** True if viewport width is under mobile breakpoint */
  isMobile: boolean;
  /** Vertical scroll offset of the visual viewport */
  offsetTop: number;
  /** True if the user prefers reduced motion */
  prefersReducedMotion: boolean;
  /** Ref to attach to the modal container to automatically detect focus on inputs */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Programmatically scroll an element into the center of the visible area */
  scrollToElement: (element?: HTMLElement | null, customDelayMs?: number) => void;
}

export interface UseMobileKeyboardViewportOptions {
  /** Screen width threshold in px to consider mobile. Default: 640 (Tailwind sm) */
  mobileBreakpoint?: number;
  /** Minimum px reduction to consider the virtual keyboard active. Default: 120 */
  keyboardThreshold?: number;
  /** Automatically listen for focusin inside containerRef. Default: true */
  autoScrollOnFocus?: boolean;
}

/**
 * Hook to manage modal layout, height, and keyboard-aware behavior on mobile devices (Android/Capacitor, iOS, mobile web).
 * Uses window.visualViewport with fallback to window.innerHeight.
 */
export function useMobileKeyboardViewport(
  options: UseMobileKeyboardViewportOptions = {}
): MobileKeyboardViewportState {
  const {
    mobileBreakpoint = 640,
    keyboardThreshold = 120,
    autoScrollOnFocus = true,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const baselineHeightRef = useRef<number>(
    typeof window !== "undefined" ? window.innerHeight : 800
  );
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isKeyboardOpenRef = useRef<boolean>(false);

  const [prefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  const getInitialState = () => {
    if (typeof window === "undefined") {
      return {
        viewportHeight: 800,
        viewportWidth: 1024,
        isKeyboardOpen: false,
        keyboardHeight: 0,
        isMobile: false,
        offsetTop: 0,
      };
    }
    const vv = window.visualViewport;
    const currentHeight = vv ? vv.height : window.innerHeight;
    const currentWidth = vv ? vv.width : window.innerWidth;
    return {
      viewportHeight: currentHeight,
      viewportWidth: currentWidth,
      isKeyboardOpen: false,
      keyboardHeight: 0,
      isMobile: currentWidth < mobileBreakpoint,
      offsetTop: vv ? vv.offsetTop : 0,
    };
  };

  const [state, setState] = useState(getInitialState);

  // Centralized scroll-into-view helper that waits for visualViewport resize animation
  const scrollToElement = useCallback(
    (element?: HTMLElement | null, customDelayMs?: number) => {
      if (typeof window === "undefined") return;
      const target =
        element || (document.activeElement as HTMLElement | null);
      if (!target || typeof target.scrollIntoView !== "function") return;

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Android/Capacitor keyboards take ~120-200ms to finish their sliding animation.
      // If keyboard is already open, a single frame or 50ms is sufficient.
      const delay =
        customDelayMs !== undefined
          ? customDelayMs
          : isKeyboardOpenRef.current
          ? 60
          : 180;

      scrollTimeoutRef.current = setTimeout(() => {
        requestAnimationFrame(() => {
          try {
            target.scrollIntoView({
              behavior: prefersReducedMotion ? "auto" : "smooth",
              block: "center",
              inline: "nearest",
            });
          } catch {
            // Fallback for older browsers
            target.scrollIntoView(true);
          }
        });
      }, delay);
    },
    [prefersReducedMotion]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleUpdate = () => {
      const vv = window.visualViewport;
      const currentHeight = vv ? vv.height : window.innerHeight;
      const currentWidth = vv ? vv.width : window.innerWidth;
      const isMobile = currentWidth < mobileBreakpoint;
      const offsetTop = vv ? vv.offsetTop : 0;

      const activeEl = document.activeElement;
      const isEditableActive =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable);

      // If no input is focused and window grew, update baseline (e.g. orientation changed or browser bars toggled)
      if (!isEditableActive && window.innerHeight >= baselineHeightRef.current - 40) {
        baselineHeightRef.current = window.innerHeight;
      }

      const diff = baselineHeightRef.current - currentHeight;
      // Virtual keyboard takes at least keyboardThreshold px and usually occurs when an input is focused or viewport shrunk significantly
      const isKeyboard =
        isMobile &&
        (diff > keyboardThreshold || (Boolean(isEditableActive) && diff > 70));
      const keyboardHeight = isKeyboard ? Math.max(0, diff) : 0;

      isKeyboardOpenRef.current = isKeyboard;

      setState({
        viewportHeight: currentHeight,
        viewportWidth: currentWidth,
        isKeyboardOpen: isKeyboard,
        keyboardHeight,
        isMobile,
        offsetTop,
      });

      // If an editable element is focused and keyboard just opened/resized, keep it visible in view
      if (isKeyboard && isEditableActive && autoScrollOnFocus) {
        scrollToElement(activeEl as HTMLElement, 80);
      }
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", handleUpdate);
      vv.addEventListener("scroll", handleUpdate);
    }
    window.addEventListener("resize", handleUpdate);
    window.addEventListener("orientationchange", handleUpdate);

    // Initial update to sync baseline
    handleUpdate();

    return () => {
      if (vv) {
        vv.removeEventListener("resize", handleUpdate);
        vv.removeEventListener("scroll", handleUpdate);
      }
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("orientationchange", handleUpdate);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [mobileBreakpoint, keyboardThreshold, autoScrollOnFocus, scrollToElement]);

  // Automatic focusin listener on the modal container to detect any child input being tapped
  useEffect(() => {
    if (!autoScrollOnFocus) return;
    const container = containerRef.current;
    if (!container) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const isEditable =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (isEditable) {
        scrollToElement(target);
      }
    };

    container.addEventListener("focusin", handleFocusIn);
    return () => {
      container.removeEventListener("focusin", handleFocusIn);
    };
  }, [autoScrollOnFocus, scrollToElement]);

  return {
    ...state,
    prefersReducedMotion,
    containerRef,
    scrollToElement,
  };
}
