/**
 * @file app/(main)/marketplace/page.tsx
 * @description The Community Marketplace.
 * Allows users to discover, install, and share practice configurations (Interviews, Debates, Personas).
 * Features rating systems, reviews, and personalized views for 'My Shared' items.
 */

"use client"

import { useEffect, useState } from "react"
import {
  IconSearch,
  IconRobot,
  IconFilter,
  IconTrash,
  IconDownload,
  IconCards,
  IconMessageDots,
  IconDeviceGamepad2,
  IconPencil,
  IconLoader2,
} from "@tabler/icons-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Rating, RatingButton } from "@/components/ui/shadcn-io/rating" // Custom rating component
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

/**
 * MarketplaceItem Interface
 * Defines the community-shared structure of a practice configuration.
 */
interface MarketplaceItem {
  id: string
  name: string
  description: string
  type: string // e.g., 'INTERVIEW', 'DEBATE', 'AI_PERSONA'
  content: Record<string, unknown>
  userId: string
  user: {
    name: string
    image: string | null
  }
  isInstalled?: boolean // Local status for the current user
  ratings?: { userId: string; value: number; id: string }[]
  reviews?: {
    id: string
    userId: string
    content: string
    createdAt: string
    user: { name: string; image: string | null | undefined }
  }[]
  createdAt: string
}

/**
 * MarketplacePage Component
 * Main hub for community sharing.
 */
export default function MarketplacePage() {
  const [items, setItems] = useState<MarketplaceItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all") // 'all' (Discover) or 'mine' (User's shared)

  // State for editing user's own marketplace listings
  const [editingItem, setEditingItem] = useState<MarketplaceItem | null>(null)
  const [editForm, setEditForm] = useState({ name: "", description: "" })

  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set())
  const [uninstallingIds, setUninstallingIds] = useState<Set<string>>(new Set())

  /**
   * Fetches marketplace items based on the active tab.
   * @param mine - Boolean indicating whether to filter for the current user's shared items.
   */
  const fetchItems = async (mine = false) => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/marketplace${mine ? "?mine=true" : ""}`,
      )
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setItems(data)
    } catch (error) {
      console.error("Error fetching marketplace:", error)
      toast.error("Failed to load marketplace items")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchItems(activeTab === "mine")
  }, [activeTab])

  /**
   * Clones a marketplace item into the user's private collection.
   */
  const handleInstall = async (id: string) => {
    setInstallingIds((prev) => new Set(prev).add(id))
    try {
      const response = await fetch(`/api/marketplace/${id}/install`, {
        method: "POST",
      })
      if (!response.ok) throw new Error("Install failed")
      // Update local state without full reload
      setItems(
        items.map((i) => (i.id === id ? { ...i, isInstalled: true } : i)),
      )
      toast.success("Successfully installed to your collection!")
    } catch (error) {
      console.error("Install error:", error)
      toast.error("Failed to install item")
    } finally {
      setInstallingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  /**
   * Unlinks a marketplace item from the user's collection.
   */
  const handleUninstall = async (id: string) => {
    setUninstallingIds((prev) => new Set(prev).add(id))
    try {
      const response = await fetch(`/api/marketplace/${id}/uninstall`, {
        method: "POST",
      })
      if (!response.ok) throw new Error("Uninstall failed")
      setItems(
        items.map((i) => (i.id === id ? { ...i, isInstalled: false } : i)),
      )
      toast.success("Removed from your collection")
    } catch (error) {
      console.error("Uninstall error:", error)
      toast.error("Failed to uninstall item")
    } finally {
      setUninstallingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  /**
   * Removes a user's item from the public marketplace.
   */
  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/marketplace/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Delete failed")
      setItems(items.filter((i) => i.id !== id))
      toast.success("Item removed from Marketplace")
    } catch (error) {
      console.error("Delete error:", error)
      toast.error("Failed to remove item")
    }
  }

  /**
   * Opens the edit dialog for a specific listing.
   */
  const handleEdit = (item: MarketplaceItem) => {
    setEditingItem(item)
    setEditForm({ name: item.name, description: item.description })
  }

  /**
   * Updates the public metadata of a marketplace listing.
   */
  const handleUpdate = async () => {
    if (!editingItem) return
    try {
      const response = await fetch(`/api/marketplace/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          content: { ...editingItem.content, ...editForm },
        }),
      })
      if (!response.ok) throw new Error("Update failed")
      setItems(
        items.map((i) => (i.id === editingItem.id ? { ...i, ...editForm } : i)),
      )
      setEditingItem(null)
      toast.success("Marketplace item updated!")
    } catch (error) {
      console.error("Update error:", error)
      toast.error("Failed to update item")
    }
  }

  // Helper: Text for the primary action button based on item type
  const getInstallLabel = (type: string) => {
    switch (type) {
      case "INTERVIEW":
        return "Add to Interviews"
      case "DEBATE":
        return "Add to Debates"
      case "AI_PERSONA":
        return "Add to AI Personas"
      default:
        return "Install"
    }
  }

  // Helper: Visual identifier for item type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "INTERVIEW":
        return <IconMessageDots className="size-4" />
      case "DEBATE":
        return <IconDeviceGamepad2 className="size-4" />
      case "AI_PERSONA":
        return <IconRobot className="size-4" />
      default:
        return <IconCards className="size-4" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "INTERVIEW":
        return "Interview"
      case "DEBATE":
        return "Debate"
      case "AI_PERSONA":
        return "AI Persona"
      default:
        return type
    }
  }

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="flex flex-1 flex-col gap-8 p-8 pt-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-muted-foreground mt-1">
            Discover and share practice configurations with the community.
          </p>
        </div>
      </div>

      {/* Toolbar: Search, Filter, and Views (Discover vs My Shared) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full max-w-md">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              placeholder="Search items..."
              className="pl-9 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <IconFilter className="size-4" />
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-fit">
          <TabsList className="bg-muted/50 border border-muted/30">
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-background"
            >
              Discover
            </TabsTrigger>
            <TabsTrigger
              value="mine"
              className="data-[state=active]:bg-background"
            >
              My Shared Items
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Grid View */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card
              key={i}
              className="animate-pulse h-64 bg-muted/20 border-muted/50"
            />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border-t border-muted/30 mt-8">
          <div className="size-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <IconCards className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold">No items found</h3>
          <p className="text-muted-foreground max-w-sm mt-2">
            {searchQuery
              ? "Try adjusting your search query."
              : "Be the first to share something on the marketplace!"}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              className="flex flex-col hover:shadow-xl transition-all border-muted/50 group bg-card/50 overflow-hidden relative"
            >
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-4">
                  <Badge
                    variant="secondary"
                    className="gap-1.5 px-2 py-0.5 bg-primary/10 text-primary border-primary/20"
                  >
                    {getTypeIcon(item.type)}
                    {getTypeLabel(item.type)}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-6 border border-muted/50">
                      <AvatarImage src={item.user.image || ""} />
                      <AvatarFallback className="text-[8px] bg-muted">
                        {item.user.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[80px]">
                      {item.user.name}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/marketplace/items/${item.id}`}
                  className="hover:text-primary transition-colors"
                >
                  <CardTitle className="text-xl line-clamp-1 cursor-pointer">
                    {item.name}
                  </CardTitle>
                </Link>
                {/* Aggregate Community Ratings */}
                {item.ratings && item.ratings.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <Rating
                      value={
                        item.ratings.reduce((acc, r) => acc + r.value, 0) /
                        item.ratings.length
                      }
                      readOnly
                    >
                      {Array.from({ length: 5 }).map((_, i) => (
                        <RatingButton
                          key={i}
                          size={12}
                          className="text-yellow-500"
                        />
                      ))}
                    </Rating>
                    <span className="text-[10px] font-bold text-yellow-500">
                      {(
                        item.ratings.reduce((acc, r) => acc + r.value, 0) /
                        item.ratings.length
                      ).toFixed(1)}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">
                      ({item.ratings.length})
                    </span>
                  </div>
                )}
              </CardHeader>

              <CardContent className="flex-1 pb-4">
                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                  {item.description}
                </p>
              </CardContent>

              {/* Action Buttons based on ownership and installation status */}
              <CardFooter className="pt-0 flex items-center justify-between border-t border-muted/20 p-4 bg-muted/5">
                {activeTab === "mine" ? (
                  /* Own Shared Items: Edit/Delete controls */
                  <div className="flex gap-2 w-full">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 gap-2 shadow-sm border-muted-foreground/20 hover:bg-muted/50"
                      onClick={() => handleEdit(item)}
                    >
                      <IconPencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10 border-destructive/20 shadow-sm"
                      onClick={() => handleDelete(item.id)}
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  </div>
                ) : item.isInstalled ? (
                  /* Installed Community Items: Remove option */
                  <Button
                    variant="outline"
                    className="w-full h-9 gap-2 border-primary/20 hover:bg-primary/5 text-primary"
                    onClick={() => handleUninstall(item.id)}
                    disabled={uninstallingIds.has(item.id)}
                  >
                    {uninstallingIds.has(item.id) ? (
                      <IconLoader2 className="size-4 animate-spin" />
                    ) : (
                      <IconTrash className="size-4" />
                    )}
                    {uninstallingIds.has(item.id) ? "Removing..." : "Remove"}
                  </Button>
                ) : (
                  /* Discover Tab: Install button */
                  <Button
                    className="w-full h-9 gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    onClick={() => handleInstall(item.id)}
                    disabled={installingIds.has(item.id)}
                  >
                    {installingIds.has(item.id) ? (
                      <IconLoader2 className="size-4 animate-spin" />
                    ) : (
                      <IconDownload className="size-4" />
                    )}
                    {installingIds.has(item.id)
                      ? "Installing..."
                      : getInstallLabel(item.type)}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Listing Dialog (Only for 'My Shared Items') */}
      <Dialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
      >
        <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-900">
          <DialogHeader>
            <DialogTitle>Edit Marketplace Listing</DialogTitle>
            <DialogDescription>
              Update how your Shared Item appears to others.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 text-white">
            <div className="grid gap-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                className="bg-zinc-900 border-zinc-800"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Marketplace Description</Label>
              <Textarea
                id="description"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
                className="bg-zinc-900 border-zinc-800 min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
