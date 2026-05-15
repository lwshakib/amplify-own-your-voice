/**
 * @file app/(main)/marketplace/items/[id]/page.tsx
 * @description Detailed view for a specific marketplace item.
 * Allows users to review, rate, and install shared practice configurations (Interviews, Debates, AI Personas).
 */

"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import {
  IconArrowLeft,
  IconDownload,
  IconTrash,
  IconPencil,
  IconMessageDots,
  IconDeviceGamepad2,
  IconRobot,
  IconCards,
  IconCalendar,
  IconSend,
  IconLoader2,
} from "@tabler/icons-react"
// Specialized rating component for community feedback
import { Rating, RatingButton } from "@/components/ui/shadcn-io/rating"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
// Renders the marketplace description with rich text support
import ReactMarkdown from "react-markdown"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

/**
 * Interface representing a Marketplace Item with user metrics and social data.
 */
interface MarketplaceItem {
  id: string
  name: string
  description: string
  type: string
  content: Record<string, unknown>
  userId: string
  user: {
    name: string
    image: string | null
  }
  isInstalled: boolean // Whether the current user has this in their collection
  ratings: { userId: string; value: number; id: string }[]
  reviews: {
    id: string
    userId: string
    content: string
    createdAt: string
    user: { name: string; image: string | null | undefined }
  }[]
  createdAt: string
}

/**
 * ItemDetailPage Component
 * Renders a full-page description of a Shared Item and provides community interactions.
 */
export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { data: authSession } = authClient.useSession()

  // Data State
  const [item, setItem] = useState<MarketplaceItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Interaction States
  const [isDeleting, setIsDeleting] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)

  // Edit State (Only for owners)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: "", description: "" })

  // Social Stats States
  const [ratingValue, setRatingValue] = useState(0)
  const [reviewContent, setReviewContent] = useState("")
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)

  /**
   * Fetch item data and social metadata on mount.
   */
  useEffect(() => {
    const fetchItem = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/marketplace/${id}`)
        if (!response.ok) throw new Error("Failed to fetch")
        const data = await response.json()
        setItem(data)
        setEditForm({ name: data.name, description: data.description })
      } catch (error) {
        console.error("Fetch error:", error)
        toast.error("Failed to load item details")
        router.push("/marketplace")
      } finally {
        setIsLoading(false)
      }
    }

    fetchItem()
  }, [id, router])

  /**
   * Adds the marketplace item to the user's private collection.
   */
  const handleInstall = async () => {
    setIsInstalling(true)
    try {
      const response = await fetch(`/api/marketplace/${id}/install`, {
        method: "POST",
      })
      if (!response.ok) throw new Error("Install failed")

      setItem((prev) => (prev ? { ...prev, isInstalled: true } : null))
      toast.success("Successfully installed!")
    } catch (error) {
      console.error("Install error:", error)
      toast.error("Failed to install")
    } finally {
      setIsInstalling(false)
    }
  }

  /**
   * Removes the item from the user's collection (Uninstall).
   */
  const handleUninstall = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/marketplace/${id}/uninstall`, {
        method: "POST",
      })
      if (!response.ok) throw new Error("Uninstall failed")

      setItem((prev) => (prev ? { ...prev, isInstalled: false } : null))
      toast.success("Removed from your collection")
    } catch (error) {
      console.error("Uninstall error:", error)
      toast.error("Failed remove")
    } finally {
      setIsDeleting(false)
    }
  }

  /**
   * Submits a numeric rating. Uses Optimistic UI patterns.
   */
  const handleRate = async (value: number) => {
    if (!authSession?.user?.id || !item) return

    const userId = authSession.user.id
    const prevRatings = [...item.ratings]
    const prevRatingValue = ratingValue

    // Optimistic Update: Reflect the change immediately in the local state
    const existingRatingIndex = item.ratings.findIndex(
      (r) => r.userId === userId,
    )
    const newRatings = [...item.ratings]
    if (existingRatingIndex > -1) {
      newRatings[existingRatingIndex] = {
        ...newRatings[existingRatingIndex],
        value,
      }
    } else {
      newRatings.push({ userId, value, id: `temp-${Date.now()}` })
    }

    setItem({ ...item, ratings: newRatings })
    setRatingValue(value)

    try {
      const response = await fetch(`/api/marketplace/${id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      })
      if (!response.ok) throw new Error("Rating failed")
      toast.success("Rating submitted!")
    } catch (error) {
      console.error("Rating error:", error)
      toast.error("Failed to submit rating")
      // Rollback to previous state on failure
      setItem({ ...item, ratings: prevRatings })
      setRatingValue(prevRatingValue)
    }
  }

  /**
   * Submits a textual review. Uses Optimistic UI patterns.
   */
  const handleReview = async () => {
    if (!reviewContent.trim() || !authSession?.user || !item) return
    setIsSubmittingReview(true)

    const user = authSession.user
    const prevReviews = [...item.reviews]
    const content = reviewContent

    // Optimistic Update
    const existingReviewIndex = item.reviews.findIndex(
      (r) => r.userId === user.id,
    )
    const newReviews = [...item.reviews]
    const optimisticReview = {
      id: `temp-${Date.now()}`,
      userId: user.id,
      content,
      createdAt: new Date().toISOString(),
      user: {
        name: user.name,
        image: user.image,
      },
    }

    if (existingReviewIndex > -1) {
      newReviews[existingReviewIndex] = optimisticReview
    } else {
      newReviews.unshift(optimisticReview)
    }

    setItem({ ...item, reviews: newReviews })
    setReviewContent("")

    try {
      const response = await fetch(`/api/marketplace/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      if (!response.ok) throw new Error("Review failed")
    } catch (error) {
      console.error("Review error:", error)
      toast.error("Failed to post review")
      // Rollback
      setItem({ ...item, reviews: prevReviews })
      setReviewContent(content)
    } finally {
      setIsSubmittingReview(false)
    }
  }

  /**
   * Permanently deletes the marketplace listing (Owner only).
   */
  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/marketplace/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Delete failed")
      toast.success("Item removed from Marketplace")
      router.push("/marketplace")
    } catch (error) {
      console.error("Delete error:", error)
      toast.error("Failed to remove item")
      setIsDeleting(false)
    }
  }

  /**
   * Updates the marketplace listing metadata (Owner only).
   */
  const handleUpdate = async () => {
    try {
      const response = await fetch(`/api/marketplace/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          content: { ...item?.content, ...editForm },
        }),
      })
      if (!response.ok) throw new Error("Update failed")

      setItem((prev) => (prev ? { ...prev, ...editForm } : null))
      setIsEditDialogOpen(false)
      toast.success("Listing updated!")
    } catch (error) {
      console.error("Update error:", error)
      toast.error("Failed to update item")
    }
  }

  /**
   * Icon Mapping based on item type.
   */
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "INTERVIEW":
        return <IconMessageDots className="size-5" />
      case "DEBATE":
        return <IconDeviceGamepad2 className="size-5" />
      case "AI_PERSONA":
        return <IconRobot className="size-5" />
      default:
        return <IconCards className="size-5" />
    }
  }

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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "INTERVIEW":
        return "Interview"
      case "DEBATE":
        return "Debate"
      case "AI_PERSONA":
        return "AI Persona"
      default:
        return type.replace(/_/g, " ")
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <IconLoader2 className="animate-spin size-8 text-primary" />
      </div>
    )
  }

  if (!item) return null

  const isOwner = authSession?.user?.id === item.userId

  return (
    <div className="flex flex-1 flex-col gap-8 p-8 pt-6 max-w-[1400px] mx-auto w-full">
      {/* Header section with back button and type-specific badges */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <IconArrowLeft className="size-5" />
        </Button>
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold tracking-tight">{item.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant="secondary"
              className="gap-1.5 bg-primary/10 text-primary border-primary/20"
            >
              {getTypeIcon(item.type)}
              {getTypeLabel(item.type)}
            </Badge>
            <span className="text-muted-foreground text-sm flex items-center gap-1 ml-2">
              <IconCalendar className="size-3.5" />
              Shared on {new Date(item.createdAt).toLocaleDateString()}
            </span>
            <Separator orientation="vertical" className="h-4 mx-2" />
            {/* Star Rating Summary */}
            <div className="flex items-center gap-1.5 bg-yellow-500/10 px-2.5 py-1 rounded-full border border-yellow-500/20">
              <Rating
                value={
                  item.ratings.length > 0
                    ? item.ratings.reduce((acc, r) => acc + r.value, 0) /
                      item.ratings.length
                    : 0
                }
                readOnly
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <RatingButton key={i} size={14} className="text-yellow-500" />
                ))}
              </Rating>
              <span className="text-xs font-bold text-yellow-500">
                {item.ratings.length > 0
                  ? (
                      item.ratings.reduce((acc, r) => acc + r.value, 0) /
                      item.ratings.length
                    ).toFixed(1)
                  : "N/A"}
              </span>
              <span className="text-[10px] text-yellow-500/60 font-medium">
                ({item.ratings.length})
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Main Content Area: Detailed Markdown Description */}
        <div className="md:col-span-7 space-y-8">
          <Card className="bg-card/50 border-muted/50">
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-invert max-w-none text-muted-foreground leading-relaxed">
                <ReactMarkdown>{item.description}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Metadata and Community Interactions */}
        <div className="md:col-span-5 space-y-6">
          <div className="flex flex-col gap-3">
            {/* Context-aware Install/Uninstall Buttons */}
            {item.isInstalled ? (
              <Button
                variant="outline"
                className="w-full h-12 gap-2 text-base border-primary/20 hover:bg-primary/5 text-primary"
                disabled={isDeleting}
                onClick={handleUninstall}
              >
                {isDeleting ? (
                  <IconLoader2 className="size-5 animate-spin" />
                ) : (
                  <IconTrash className="size-5" />
                )}
                {isDeleting ? "Removing..." : "Remove Template"}
              </Button>
            ) : (
              <Button
                className="w-full h-12 gap-2 text-base shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]"
                disabled={isInstalling}
                onClick={handleInstall}
              >
                {isInstalling ? (
                  <IconLoader2 className="size-5 animate-spin" />
                ) : (
                  <IconDownload className="size-5" />
                )}
                {isInstalling ? "Installing..." : getInstallLabel(item.type)}
              </Button>
            )}

            {/* Owner controls: Edit, Delete Listing */}
            {isOwner && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-11 gap-2"
                  onClick={() => setIsEditDialogOpen(true)}
                >
                  <IconPencil className="size-4" />
                  Update
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-11 w-11 p-0 text-destructive hover:bg-destructive/10 border-destructive/20"
                      disabled={isDeleting}
                    >
                      <IconTrash className="size-5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-zinc-950 border-zinc-900">
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Are you absolutely sure?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently
                        remove &quot;{item.name}&quot; from the marketplace.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-zinc-900 border-zinc-800">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? "Removing..." : "Remove Item"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          {/* Author attribution */}
          <Card className="bg-card/50 border-muted/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Shared By
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar className="size-10 border">
                  <AvatarImage src={item.user.image || ""} />
                  <AvatarFallback>{item.user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-bold">{item.user.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Community Contributor
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Social Feedback: Rating and Reviews List */}
          <Card className="bg-card/50 border-muted/50">
            <CardHeader>
              <CardTitle>Reviews & Ratings</CardTitle>
              <CardDescription>
                Community feedback for this item
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Submission Area */}
              <div className="flex flex-col gap-4 p-4 rounded-xl bg-muted/20 border border-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Your Rating</span>
                  <Rating
                    value={
                      ratingValue ||
                      item.ratings.find(
                        (r) => r.userId === authSession?.user?.id,
                      )?.value ||
                      0
                    }
                    onValueChange={(val) => handleRate(val)}
                  >
                    {Array.from({ length: 5 }).map((_, index) => (
                      <RatingButton
                        key={index}
                        size={24}
                        className="text-yellow-500"
                      />
                    ))}
                  </Rating>
                </div>

                <div className="flex flex-col gap-2">
                  <Textarea
                    placeholder="Write a review..."
                    className="flex-1 bg-zinc-900 border-zinc-800 min-h-[80px]"
                    value={reviewContent}
                    onChange={(e) => setReviewContent(e.target.value)}
                  />
                  <Button
                    className="w-full gap-2"
                    onClick={handleReview}
                    disabled={isSubmittingReview || !reviewContent.trim()}
                  >
                    <IconSend className="size-4" />
                    Post Review
                  </Button>
                </div>
              </div>

              {/* Chronological Reviews List */}
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {item.reviews.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground italic">
                    No reviews yet. Be the first to review!
                  </div>
                ) : (
                  item.reviews.map((review) => (
                    <div
                      key={review.id}
                      className="flex gap-4 p-4 rounded-xl border border-muted/20"
                    >
                      <Avatar className="size-8">
                        <AvatarImage src={review.user.image || ""} />
                        <AvatarFallback>
                          {review.user.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold">
                            {review.user.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-300 break-words">
                          {review.content}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Item Metadata update flow */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-900">
          <DialogHeader>
            <DialogTitle>Edit Marketplace Listing</DialogTitle>
            <DialogDescription>
              Update how your Shared Item appears to others.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
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
                <Label htmlFor="description">
                  Marketplace Description (Supports Markdown)
                </Label>
                <Textarea
                  id="description"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  className="bg-zinc-900 border-zinc-800 min-h-[250px]"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
