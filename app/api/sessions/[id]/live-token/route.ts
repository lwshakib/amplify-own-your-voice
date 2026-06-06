import { GoogleGenAI, Modality } from "@google/genai"
import { validateSession } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { getFeatureLogic } from "@/lib/features-registry"
import { getCharacter } from "@/lib/characters"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { session, errorResponse } = await validateSession()
    if (errorResponse) return errorResponse

    const interaction = await prisma.agentInteraction.findUnique({
      where: {
        id: id,
        userId: session.user.id,
      },
      include: {
        interview: true,
        debate: true,
        aiPersona: true,
        user: true,
      },
    })

    if (!interaction) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 },
      )
    }

    const feature = getFeatureLogic(interaction.type)
    if (!feature) {
      return NextResponse.json(
        { error: "Interaction type not supported" },
        { status: 400 },
      )
    }

    // Map Prisma interaction to feature-expected AgentInteraction type
    const normalizedInteraction = {
      id: interaction.id,
      type: interaction.type as string,
      userSide: interaction.userSide,
      interview: interaction.interview
        ? {
            jobTitle: interaction.interview.jobTitle,
            description: interaction.interview.description,
            type: interaction.interview.type,
            characterId: interaction.interview.characterId,
          }
        : null,
      debate: interaction.debate
        ? {
            id: interaction.debate.id,
            subject: interaction.debate.subject,
            content: interaction.debate.content,
            judgeId: interaction.debate.judgeId,
            opponentId: interaction.debate.opponentId,
            opponentIds: (interaction.debate.opponentIds as string[]) || [],
          }
        : null,
      aiPersona: interaction.aiPersona
        ? {
            id: interaction.aiPersona.id,
            name: interaction.aiPersona.name,
            instruction: interaction.aiPersona.instruction,
            characterId: interaction.aiPersona.characterId,
          }
        : null,
    }

    const systemPrompt = feature.getPrompt(
      normalizedInteraction,
      session.user as any,
      [],
    )

    const charId =
      interaction.type === "INTERVIEW"
        ? (interaction.interview?.characterId || "sarah")
        : interaction.type === "DEBATE"
          ? (interaction.debate?.judgeId || "ethan")
          : (interaction.aiPersona?.characterId || "aoede")

    const character = getCharacter(charId)
    // Multimodal Live API prebuilt voices include: Puck, Charon, Kore, Fenrir, Aoede
    const allowedVoices = ["Puck", "Charon", "Kore", "Fenrir", "Aoede"]
    let voiceName = "Aoede"

    if (
      character?.model &&
      allowedVoices.some((v) => v.toLowerCase() === character.model.toLowerCase())
    ) {
      voiceName = allowedVoices.find(
        (v) => v.toLowerCase() === character.model.toLowerCase(),
      )!
    } else {
      if (character?.gender === "male") {
        voiceName = "Charon"
      } else {
        voiceName = "Aoede"
      }
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured on server" },
        { status: 500 },
      )
    }

    const client = new GoogleGenAI({ apiKey })
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const newSessionExpireTime = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const tokenResponse = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        liveConnectConstraints: {
          model: "gemini-3.1-flash-live-preview",
          config: {
            sessionResumption: {},
            temperature: 0.7,
            responseModalities: [Modality.AUDIO],
          },
        },
        httpOptions: {
          apiVersion: "v1alpha",
        },
      },
    })

    return NextResponse.json({
      token: tokenResponse.name,
      model: "gemini-3.1-flash-live-preview",
      systemInstructions: systemPrompt,
      voiceName,
    })
  } catch (error: any) {
    console.error("Error generating live ephemeral token:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate token" },
      { status: 500 },
    )
  }
}
