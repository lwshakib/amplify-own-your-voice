import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // Fetch all interaction sessions for the user that are interviews
    const sessions = await prisma.agentInteraction.findMany({
      where: {
        userId: userId,
        type: "INTERVIEW",
        status: "COMPLETED",
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        messages: {
          where: {
            role: "user",
            feedback: { not: null },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
        metrics: true,
      },
    })

    // 1. Total Interviews (from the Interview model, not sessions)
    // The user wants the count of "Interviews" created, which matches the "Interviews Page" count.
    const totalInterviews = await prisma.interview.count({
      where: {
        userId: userId,
      },
    })

    // 2. Total Spoken Time
    const totalDurationSeconds = sessions.reduce(
      (acc, curr) => acc + curr.duration,
      0,
    )

    // 3. Average Score (overall across all metrics)
    // We need to calculate the average of all 8 metrics for each session, then average those.
    // Actually, just sum up all metrics across all sessions and divide by count * 8.
    // But we need to handle zeros (unscored sessions).

    let totalScoreSum = 0
    let totalScoreCount = 0

    // For Radar Chart (Average per metric)
    const metricSums = {
      correctness: 0,
      clarity: 0,
      relevance: 0,
      detail: 0,
      efficiency: 0,
      creativity: 0,
      communication: 0,
      problemSolving: 0,
    }
    const metricCounts = { ...metricSums } as Record<string, number>

    sessions.forEach((session) => {
      // Check if session has metrics (sum > 0)
      const m = session.metrics
      if (m) {
        const sum =
          (m.correctness ?? 0) +
          (m.clarity ?? 0) +
          (m.relevance ?? 0) +
          (m.detail ?? 0) +
          (m.efficiency ?? 0) +
          (m.creativity ?? 0) +
          (m.communication ?? 0) +
          (m.problemSolving ?? 0)

        if (sum > 0) {
          // Add to total score calculation
          totalScoreSum += sum / 8 // Average for this session
          totalScoreCount++

          // Add to individual metrics
          metricSums.correctness += m.correctness ?? 0
          metricSums.clarity += m.clarity ?? 0
          metricSums.relevance += m.relevance ?? 0
          metricSums.detail += m.detail ?? 0
          metricSums.efficiency += m.efficiency ?? 0
          metricSums.creativity += m.creativity ?? 0
          metricSums.communication += m.communication ?? 0
          metricSums.problemSolving += m.problemSolving ?? 0

          Object.keys(metricCounts).forEach((key) => {
            const val = (m as unknown as Record<string, number>)[key]
            if (typeof val === "number" && val > 0) metricCounts[key]++
          })
        }
      }
    })

    const averageScore =
      totalScoreCount > 0 ? (totalScoreSum / totalScoreCount).toFixed(1) : "0.0"

    // Prepare Radar Data
    const radarData = Object.keys(metricSums).map((key) => ({
      metric: key.charAt(0).toUpperCase() + key.slice(1),
      desktop:
        totalScoreCount > 0
          ? Math.round(
              (metricSums as Record<string, number>)[key] / totalScoreCount,
            )
          : 0,
    }))

    // Recent Insights
    // Get the most recent feedbacks
    const recentFeedbacks = sessions
      .filter((s) => s.messages.length > 0 && s.messages[0].feedback)
      .slice(0, 3)
      .map((s) => {
        const m = s.metrics
        const sum = m
          ? (m.correctness ?? 0) +
            (m.clarity ?? 0) +
            (m.relevance ?? 0) +
            (m.detail ?? 0) +
            (m.efficiency ?? 0) +
            (m.creativity ?? 0) +
            (m.communication ?? 0) +
            (m.problemSolving ?? 0)
          : 0
        return {
          title: "Feedback from " + s.createdAt.toLocaleDateString(),
          description: s.messages[0].feedback, // This might be long, but UI truncates?
          score: Math.round(sum / 8),
        }
      })

    return NextResponse.json({
      totalInterviews,
      totalDurationSeconds,
      averageScore,
      radarData,
      recentFeedbacks,
    })
  } catch (error: unknown) {
    console.error("Error fetching progress:", error)
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 },
    )
  }
}
