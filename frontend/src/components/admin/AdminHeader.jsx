"use client";

import React from "react";
import Link from "next/link";
import {
  Menu,
  Bell,
  Search,
  ExternalLink,
  User,
  LogOut,
  ShieldAlert,
} from "lucide-react";
import { DropdownMenu, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "../ui/DropdownMenu.jsx";
import { Button } from "../ui/Button.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { cn } from "../../utils/cn.js";

export function AdminHeader({ onMenuClick, title, className }) {
  const { user, logout } = useAuth();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-background/95 backdrop-blur-xs px-4 sm:px-6 shadow-2xs",
        className
      )}
    >
      {/* Left: Mobile hamburger & Context title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation sidebar"
          className="inline-flex size-9 items-center justify-center rounded-md border border-input text-foreground hover:bg-muted lg:hidden"
        >
          <Menu className="size-5" />
        </button>

        {title && (
          <h2 className="hidden sm:block text-base font-bold text-foreground tracking-tight">
            {title}
          </h2>
        )}
      </div>

      {/* Right: Search, View Store, Notifications, User */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Search palette trigger */}
        <button
          type="button"
          aria-label="Search admin console"
          className="hidden md:flex items-center gap-2 rounded-lg border border-input bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
        >
          <Search className="size-3.5" />
          <span>Search console...</span>
          <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </button>

        {/* View Storefront Link */}
        <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex gap-1.5 text-xs font-medium">
          <Link href="/" target="_blank" rel="noopener noreferrer">
            <span>View Store</span>
            <ExternalLink className="size-3.5" />
          </Link>
        </Button>

        {/* Notifications Icon */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex size-9 items-center justify-center rounded-full text-foreground hover:bg-muted transition-colors"
        >
          <Bell className="size-4" />
          <span className="absolute top-2 right-2 flex size-2 rounded-full bg-primary" />
        </button>

        {/* User Account Menu */}
        <DropdownMenu
          align="right"
          trigger={
            <button
              type="button"
              aria-label="Admin user menu"
              className="flex items-center gap-2 rounded-full border border-input bg-muted/40 p-1 pr-2 hover:bg-muted transition-colors"
            >
              <div className="flex size-7 items-center justify-center rounded-full bg-slate-900 text-white text-xs font-bold">
                {user?.firstName?.charAt(0) || "A"}
              </div>
              <span className="hidden sm:inline text-xs font-semibold max-w-[80px] truncate">
                {user?.firstName || "Admin"}
              </span>
            </button>
          }
        >
          <DropdownMenuLabel>
            <p className="font-semibold text-foreground">{user?.firstName} {user?.lastName}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary mt-1">
              Role: {user?.role || "admin"}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/admin/settings/security" className="flex items-center gap-2 w-full">
              <ShieldAlert className="size-4 text-muted-foreground" />
              <span>Security Logs</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/account/profile" className="flex items-center gap-2 w-full">
              <User className="size-4 text-muted-foreground" />
              <span>Personal Profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive">
            <LogOut className="size-4 mr-2" />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default AdminHeader;
