import { z } from "zod"

/**
 * Schema for publishing an item to the marketplace.
 */
export const PublishMarketplaceItemSchema = z.object({
  type: z.enum(["interview", "debate", "ai-persona"]),
  id: z.string().min(1, "Original ID is required"),
})

/**
 * Schema for updating an existing marketplace item.
 */
export const UpdateMarketplaceItemSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  content: z.any().optional(),
})

/**
 * Schema for rating a marketplace item.
 */
export const RateMarketplaceItemSchema = z.object({
  value: z.number().min(1).max(5),
})

/**
 * Schema for reviewing a marketplace item.
 */
export const ReviewMarketplaceItemSchema = z.object({
  content: z.string().min(1, "Review content is required"),
})
