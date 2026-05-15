/**
 * @file app/(main)/account/page.tsx
 * @description The user profile and account management page.
 * Allows users to update their name, change their password, view linked authentication methods (Google, Email), and manage active sessions.
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
import {
  IconBrandGoogle,
  IconLoader2,
  IconShieldCheck,
  IconUser,
  IconMail,
} from "@tabler/icons-react"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

/**
 * AccountPage Component
 * @returns A comprehensive settings page for user identity and security.
 */
export default function AccountPage() {
  // Current user session state
  const session = authClient.useSession()
  const user = session.data?.user

  // Profile Update State
  const [name, setName] = useState(user?.name || "")
  const [isUpdating, setIsUpdating] = useState(false)

  // Password Update State variables
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  // Linked accounts (e.g., Google OAuth, Email/Password) state
  const [accounts, setAccounts] = useState<
    { id: string; providerId: string }[] | null
  >(null)
  const [isPendingAccounts, setIsPendingAccounts] = useState(true)

  /**
   * Sync the local 'name' state with the session user name when it loads.
   */
  useEffect(() => {
    if (user?.name) {
      setName(user.name)
    }
  }, [user?.name])

  /**
   * Fetch the list of all authentication methods linked to this user's account.
   */
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const { data } = await authClient.listAccounts()
        setAccounts(data)
      } catch (error) {
        console.error("Failed to fetch accounts:", error)
      } finally {
        setIsPendingAccounts(false)
      }
    }
    fetchAccounts()
  }, [])

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

  /**
   * Handles the password change workflow.
   * Revokes other active sessions for security if successful.
   */
  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    setIsUpdatingPassword(true)
    try {
      const { error } = await authClient.changePassword({
        newPassword,
        currentPassword,
        revokeOtherSessions: true, // Security feature: logout from everywhere else
      })

      if (error) {
        toast.error(error.message || "Failed to update password")
        return
      }

      toast.success("Password updated successfully")
      // Reset form fields
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error) {
      toast.error("An unexpected error occurred")
      console.error(error)
    } finally {
      setIsUpdatingPassword(false)
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

        {/* Security Section: Password Change */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Security</CardTitle>
            <CardDescription>Update your account password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button
              variant="secondary"
              onClick={handleUpdatePassword}
              disabled={
                isUpdatingPassword ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword ||
                newPassword !== confirmPassword
              }
            >
              {isUpdatingPassword && (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update Password
            </Button>
          </CardFooter>
        </Card>

        {/* Linked Accounts & Active Sessions: Split row on larger screens */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Linked Methods: Shows if the user is connected via Google, Email, etc. */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <IconShieldCheck className="size-5" />
                Linked Accounts
              </CardTitle>
              <CardDescription>
                Connected authentication methods.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 flex-1">
              {isPendingAccounts ? (
                <div className="flex justify-center py-4">
                  <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-6">
                  {accounts?.map((account, index) => {
                    const isGoogle = account.providerId === "google"
                    const isCredential = account.providerId === "credential"

                    return (
                      <div key={account.id}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-muted">
                              {isGoogle ? (
                                <IconBrandGoogle className="size-5" />
                              ) : isCredential ? (
                                <IconMail className="size-5" />
                              ) : (
                                <IconUser className="size-5" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm capitalize text-foreground">
                                {isCredential
                                  ? "Email & Password"
                                  : account.providerId}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Connected with your{" "}
                                {isGoogle ? "Google" : "Email & Password"}{" "}
                                account.
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          >
                            Active
                          </Badge>
                        </div>
                        {index < accounts.length - 1 && (
                          <Separator className="mt-6" />
                        )}
                      </div>
                    )
                  })}
                  {(!accounts || accounts.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No linked accounts found.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
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
                    <p className="text-xs text-muted-foreground italic truncate max-w-[200px]">
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
              <p className="text-[10px] text-muted-foreground text-center">
                To sign out of all devices, use the logout button in the
                sidebar.
              </p>
            </CardContent>
            <CardFooter className="mt-auto border-t pt-4">
              <Button
                variant="outline"
                className="w-full text-xs"
                size="sm"
                onClick={() => authClient.revokeSessions()}
              >
                Revoke Other Sessions
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
