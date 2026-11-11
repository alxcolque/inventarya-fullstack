import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Tooltip } from "@nextui-org/react";
import { SidebarItemStyles } from "./sidebar.styles";
import { useSidebarContext } from "@/context/layout-context";

interface Props {
  title: string;
  icon: React.ReactNode;
  isActive?: boolean;
  href?: string;
}

export const SidebarItem = ({ icon, title, isActive, href = "" }: Props) => {
  const { setCollapsed, isCompact } = useSidebarContext();
  const location = useLocation();

  const handleClick = () => {
    if (window.innerWidth < 768) {
      setCollapsed(false);
    }
  };

  // Determine active state accurately
  const isItemActive =
    isActive !== undefined
      ? isActive
      : location.pathname === href ||
        (href !== "/" && href !== "/dashboard" && location.pathname.startsWith(href));

  const content = (
    <NavLink
      to={href}
      className="text-inherit no-underline block w-full outline-none"
      onClick={handleClick}
    >
      <div
        className={SidebarItemStyles({
          isActive: isItemActive,
          compact: isCompact,
        })}
      >
        {/* Active accent indicator bar */}
        {isItemActive && (
          <span
            className={`absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full transition-all ${
              isCompact ? "left-0.5" : "left-0"
            }`}
          />
        )}

        {/* Icon */}
        <div
          className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${
            isItemActive ? "text-primary" : "text-default-500 group-hover:text-foreground"
          }`}
        >
          {icon}
        </div>

        {/* Title (Hidden in compact mode) */}
        {!isCompact && (
          <span className="text-sm font-medium tracking-tight truncate leading-tight flex-1">
            {title}
          </span>
        )}
      </div>
    </NavLink>
  );

  if (isCompact) {
    return (
      <Tooltip
        content={title}
        placement="right"
        offset={14}
        delay={50}
        closeDelay={50}
        className="font-medium text-xs px-2.5 py-1"
      >
        {content}
      </Tooltip>
    );
  }

  return content;
};

