/**
 * @file app/(main)/account/page.tsx
 * @description The user profile and account management page.
 * Allows users to update their display name and view active login sessions.
 */

"use client"

import { useState, useEffect } from "react"
import { authClient } from "@/lib/auth-client" // Better Auth frontend client
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner" // For user notifications
import { IconLoader2, IconShieldCheck, IconUser } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"

/**
 * AccountPage Component
 * @returns A comprehensive settings page for user identity and sessions.
 */
export default function AccountPage() {
  // Current user session state
  const session = authClient.useSession()
  const user = session.data?.user

  // Profile Update State
  const [name, setName] = useState(user?.name || "")
  const [isUpdating, setIsUpdating] = useState(false)

  /**
   * Sync the local 'name' state with the session user name when it loads.
   */
  useEffect(() => {
    if (user?.name) {
      setName(user.name)
    }
  }, [user?.name])

  /**
   * Updates the user's display name via the authClient.
   */
  const handleUpdateName = async () => {
    if (!name || name === user?.name) return

    setIsUpdating(true)
    try {
      await authClient.updateUser({
        name: name,
      })
      toast.success("Name updated successfully")
    } catch (error) {
      toast.error("Failed to update name")
      console.error(error)
    } finally {
      setIsUpdating(false)
    }
  }

  // Show a loading spinner while the session itself is still being determined
  if (session.isPending) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Fallback if the user is not authenticated
  if (!user) {
    return (
      <div className="p-8 text-center">
        <p>Please sign in to view your account details.</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 space-y-8 py-10">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground">
          Manage your account settings and profile.
        </p>
      </div>

      <div className="grid gap-8">
        {/* Profile Section: Display Name & Email */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconUser className="size-5" />
              Profile Details
            </CardTitle>
            <CardDescription>
              Update your public profile information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                value={user.email}
                disabled
                className="bg-muted cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">
                Email address cannot be changed.
              </p>
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button
              onClick={handleUpdateName}
              disabled={isUpdating || !name || name === user.name}
            >
              {isUpdating && (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </CardFooter>
        </Card>

        {/* Sessions: Displays current login info and allows revoking other sessions */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconShieldCheck className="size-5" />
              Active Sessions
            </CardTitle>
            <CardDescription>
              Manage your active login sessions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">This Device</p>
                  <p className="text-xs text-muted-foreground italic truncate max-w-[400px]">
                    {session.data?.session?.userAgent || "Current Session"}
                  </p>
                </div>
                <Badge
                  className="bg-blue-500/10 text-blue-500 border-blue-500/20"
                  variant="outline"
                >
                  Current
                </Badge>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center sm:text-left">
              To sign out of all devices, use the logout button in the sidebar.
            </p>
          </CardContent>
          <CardFooter className="border-t pt-4">
            <Button
              variant="outline"
              className="w-full sm:w-auto text-xs"
              size="sm"
              onClick={() => authClient.revokeSessions()}
            >
              Revoke Other Sessions
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
