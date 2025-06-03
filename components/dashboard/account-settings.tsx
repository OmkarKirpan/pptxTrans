"use client"

import { format } from "date-fns"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Calendar, Shield, UserCheck } from "lucide-react"
import type { User } from "@supabase/supabase-js"

interface AccountSettingsProps {
  user: User
}

export default function AccountSettings({ user }: AccountSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Account Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Account Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Account Created</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(user.created_at), "PPP")}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <UserCheck className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Last Sign In</p>
              <p className="text-sm text-muted-foreground">
                {user.last_sign_in_at 
                  ? format(new Date(user.last_sign_in_at), "PPp")
                  : "Never"
                }
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border p-3">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Email Verification Status</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={user.email_confirmed_at ? "default" : "secondary"}>
                {user.email_confirmed_at ? "Verified" : "Unverified"}
              </Badge>
              {user.email_confirmed_at && (
                <span className="text-xs text-muted-foreground">
                  Verified on {format(new Date(user.email_confirmed_at), "PP")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Avatar Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Avatar & Display</h3>
        <div className="rounded-lg border p-4 bg-muted/50">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/20 p-2">
              <UserCheck className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Automatic Avatar Generation</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your avatar is automatically generated based on your name or email address. 
                This ensures consistency across the platform while maintaining your privacy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 