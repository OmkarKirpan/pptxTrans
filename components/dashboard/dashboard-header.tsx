"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import { ThemeToggle } from "@/components/theme-toggle"
import { LogOut, PlusCircle, Settings, UserCircle, LayoutDashboard, Bell, ChevronLeft } from "lucide-react"
import type { User } from "@supabase/supabase-js"
import { useNotifications } from "@/lib/store"
import { ReactNode } from "react"

interface DashboardHeaderProps {
  user?: User | null
  title?: string
  showBackButton?: boolean
  children?: ReactNode
}

export default function DashboardHeader({ user, title, showBackButton, children }: DashboardHeaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const { unreadCount } = useNotifications()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh() // Important to clear server-side cache of user
  }

  const getInitials = (email?: string) => {
    if (!email) return "?"
    const parts = email.split("@")[0].split(/[._-]/)
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return email.substring(0, 2).toUpperCase()
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 shadow-sm backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex items-center gap-2">
        {showBackButton && (
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        {title ? (
          <h1 className="text-xl font-semibold">{title}</h1>
        ) : (
          <Link href="/dashboard" className="flex items-center gap-2 text-xl font-semibold text-primary">
            <LayoutDashboard className="h-6 w-6" />
            <span>Translator Dashboard</span>
          </Link>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        {/* Children for custom actions */}
        {children}
        
        <ThemeToggle />
        
        {/* Notifications Button */}
        <Button variant="ghost" className="relative" onClick={() => router.push("/dashboard/notifications")}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
        
        {!title && (
          <Button asChild>
            <Link href="/dashboard/new-session">
              <PlusCircle className="mr-2 h-5 w-5" />
              New Session
            </Link>
          </Button>
        )}
        
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10 border border-primary/50">
                  {/* Placeholder for actual avatar image if available */}
                  {/* <AvatarImage src={user.user_metadata?.avatar_url || "/placeholder.svg"} alt={user.email} /> */}
                  <AvatarFallback className="bg-primary/20 text-primary font-medium">
                    {getInitials(user.email)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user.user_metadata?.full_name || user.email?.split("@")[0]}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/dashboard/profile")}>
                <UserCircle className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
