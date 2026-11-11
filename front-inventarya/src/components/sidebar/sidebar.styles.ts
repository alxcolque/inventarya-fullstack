import { tv } from "@nextui-org/react";
/* Scrollbar */

export const SidebarStyles = tv({
  base: "bg-background/95 backdrop-blur-md fixed top-16 md:top-0 left-0 bottom-0 w-64 sm:w-72 max-w-[85vw] md:w-64 -translate-x-full shrink-0 z-[22] border-r border-divider flex flex-col py-2 transition-all duration-300 ease-in-out md:static md:translate-x-0 md:h-[100dvh] md:max-h-[100dvh] md:bottom-auto pointer-events-auto h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] overflow-y-auto overflow-x-hidden md:overflow-hidden no-scrollbar scrollbar-none",
  variants: {
    collapsed: {
      true: "translate-x-0 shadow-2xl [display:inherit]",
      false: "",
    },
    compact: {
      true: "md:w-[72px] md:px-2",
      false: "w-64 sm:w-72 max-w-[85vw] md:w-64 px-3.5",
    },
  },
  defaultVariants: {
    compact: false,
  },
});

export const SidebarItemStyles = tv({
  base: "relative flex items-center gap-3 w-full min-h-[42px] py-2 px-3 rounded-xl cursor-pointer transition-all duration-200 active:scale-[0.98] group",
  variants: {
    isActive: {
      true: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary font-semibold shadow-xs",
      false: "text-default-600 hover:text-default-900 hover:bg-default-100 dark:hover:bg-default-100/60 font-medium",
    },
    compact: {
      true: "justify-center px-0 w-10 h-10 mx-auto",
      false: "",
    },
  },
});

export const SidebarHeaderStyles = tv({
  base: "hidden md:flex items-center px-2 py-1 shrink-0 transition-all duration-300",
});

export const SidebarBodyStyles = tv({
  base: "flex flex-col gap-3 my-1.5 px-0.5 pb-32 md:pb-10 md:flex-1 md:min-h-0 md:overflow-y-auto md:overflow-x-hidden md:no-scrollbar md:scrollbar-none",
});

export const SidebarFooterStyles = tv({
  base: "hidden md:flex pt-2 border-t border-divider px-1 flex-col gap-2 shrink-0",
});

export const SidebarOverlayStyles = tv({
  base: "fixed top-16 inset-x-0 bottom-0 bg-black/50 backdrop-blur-xs z-[21] transition-opacity md:hidden pointer-events-auto",
});

(SidebarStyles as any).Header = SidebarHeaderStyles;
(SidebarStyles as any).Body = SidebarBodyStyles;
(SidebarStyles as any).Footer = SidebarFooterStyles;
(SidebarStyles as any).Overlay = SidebarOverlayStyles;

