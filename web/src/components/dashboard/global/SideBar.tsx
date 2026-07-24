"use client";

import {
  LogOutDoor,
  DashboardIcon,
  GiftIcon,
  WalletIcon,
  ProfileIcon,
  MoonIcon,
  SettingsIcon,
  HelpIcon,
} from "@/assets/svg";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ active?: boolean }>;
  badge?: number;
}

const mainMenuItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard/sender", icon: DashboardIcon },
  { name: "Gifts", href: "/dashboard/gifts", icon: GiftIcon, badge: 5 },
  { name: "Wallet", href: "/dashboard/wallet", icon: WalletIcon },
];

const generalMenuItems: NavItem[] = [
  { name: "Profile", href: "/profile", icon: ProfileIcon },
  { name: "Settings", href: "/settings", icon: SettingsIcon },
  { name: "Help Desk", href: "/help", icon: HelpIcon },
];

interface SideBarProps {
  isOpen: boolean;
  onClose: () => void;
}

const normalizePath = (path: string | null) => {
  if (!path || path === "/") {
    return "/";
  }

  return path.endsWith("/") ? path.slice(0, -1) : path;
};

const getCurrentNavHref = (
  items: Array<{ href: string }>,
  pathname: string | null,
) => {
  const normalizedPathname = normalizePath(pathname);

  const matchingItems = items.filter(({ href }) => {
    const normalizedHref = normalizePath(href);

    return (
      normalizedPathname === normalizedHref ||
      normalizedPathname.startsWith(`${normalizedHref}/`)
    );
  });

  if (matchingItems.length === 0) {
    return null;
  }

  return matchingItems.reduce((currentBestMatch, item) => {
    return normalizePath(item.href).length > normalizePath(currentBestMatch.href).length
      ? item
      : currentBestMatch;
  }).href;
};

export const SideBar = ({ isOpen, onClose }: SideBarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthContext();
  const [darkMode, setDarkMode] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateViewport = (event?: MediaQueryListEvent) => {
      setIsDesktopViewport(event?.matches ?? mediaQuery.matches);
    };

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/auth/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const allMenuItems = [...mainMenuItems, ...generalMenuItems];
  const currentNavHref = getCurrentNavHref(allMenuItems, pathname);

  const renderNavLink = (
    item: (typeof allMenuItems)[number],
    {
      compact = false,
      applyAriaCurrent = true,
    }: { compact?: boolean; applyAriaCurrent?: boolean } = {},
  ) => {
    const Icon = item.icon;
    const active = currentNavHref === item.href;

    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={onClose}
        aria-current={applyAriaCurrent && active ? "page" : undefined}
        className={`flex items-center ${
          compact ? "gap-3 rounded-xl" : "justify-between rounded-lg"
        } px-4 py-3 transition-colors ${
          active
            ? "bg-[#ECEFFE] text-[#5A42DE]"
            : "text-gray-600 hover:bg-gray-50"
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon active={active} />
          <span className="text-sm font-medium">{item.name}</span>
        </div>
        {!compact && item.badge && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              active
                ? "bg-white/20 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const sidebarContent = (applyAriaCurrent: boolean) => (
    <>
      {}
      <div className="mb-10 flex items-center justify-between sticky top-0 left-0 bg-white z-10 max-h-screen">
        <Image src="/logo.png" alt="Zendvo logo" width={130} height={40} />
        <button
          onClick={onClose}
          className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      {}
      <div className="mb-10">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Main Menu
        </p>
        <nav className="flex flex-col gap-2">
          {mainMenuItems.map((item) =>
            renderNavLink(item, { applyAriaCurrent }),
          )}
        </nav>
      </div>

      {}
      <div className="flex-1">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          General
        </p>
        <nav className="flex flex-col gap-2">
          {generalMenuItems
            .slice(0, 1)
            .map((item) =>
              renderNavLink(item, { compact: true, applyAriaCurrent }),
            )}

          <div className="flex items-center justify-between px-4 py-3 text-gray-600">
            <div className="flex items-center gap-3">
              <MoonIcon />
              <span className="text-sm font-medium">Dark Mode</span>
            </div>
            <div
              role="switch"
              aria-checked={darkMode}
              tabIndex={0}
              onClick={() => setDarkMode(!darkMode)}
              className={`relative cursor-pointer w-11 h-6 rounded-full transition-colors shrink-0 ${
                darkMode ? "bg-[#5A42DE]" : "bg-gray-200"
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  darkMode ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </div>
          </div>

          {generalMenuItems
            .slice(1)
            .map((item) =>
              renderNavLink(item, { compact: true, applyAriaCurrent }),
            )}
        </nav>
      </div>

      {}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-gray-700 transition-colors w-full text-left"
      >
        <LogOutDoor />
        <span className="text-sm font-medium">Logout</span>
      </button>
    </>
  );

  return (
    <>
      {}
      <aside
        aria-hidden={!isDesktopViewport}
        className="h-screen hidden w-61 px-3 py-8 md:px-5 fixed top-0 left-0 lg:flex flex-col bg-white border-r border-gray-100 overflow-y-auto"
      >
        {sidebarContent(isDesktopViewport)}
      </aside>
      {}
      <div className="hidden lg:block w-61 shrink-0" />

      {}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {}
      <aside
        aria-hidden={isDesktopViewport || !isOpen}
        className={`fixed top-0 left-0 h-screen w-72 px-5 py-8 flex flex-col bg-white z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent(!isDesktopViewport && isOpen)}
      </aside>
    </>
  );
};
