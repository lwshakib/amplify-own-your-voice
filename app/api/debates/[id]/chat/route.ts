import { NextRequest, NextResponse } from "next/server"
import { getSignedDownloadUrl } from "@/lib/s3"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { aiService } from "@/services/ai.services"
import { DebateResponseSchema } from "@/schemas/debate"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { messages, duration, audioUrl, audioPublicId } = await req.json()

    // Fetch the interaction and debate
    const interaction = await prisma.agentInteraction.findUnique({
      where: { id: sessionId },
      include: {
        debate: true,
        user: true,
      },
    })

    if (!interaction || !interaction.debate) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const { getCharacter, CHARACTERS } = await import("@/lib/characters")
    const judge = getCharacter(interaction.debate.judgeId || "ethan")

    // Pick 3 opponent characters by their IDs
    // The lead opponent is stored in debate.opponentId
    // Deputy and whip are any other two characters (not the lead, not the judge)
    const leadId = interaction.debate.opponentId || "sophia"
    const lead = getCharacter(leadId) || CHARACTERS[0]

    // Pick two more characters that aren't lead or judge
    const judgeId = interaction.debate.judgeId || "ethan"
    const available = CHARACTERS.filter(
      (c) => c.id !== lead.id && c.id !== judgeId,
    )
    const deputy = available[0] || CHARACTERS[1]
    const whip = available[1] || CHARACTERS[2]

    const userName = interaction.user?.name || "User"
    const motion = interaction.debate.subject
    const extraInfo = interaction.debate.content || "No extra context provided."

    if (!interaction.userSide) {
      return NextResponse.json(
        { error: "User side not selected" },
        { status: 400 },
      )
    }
    const userSide = interaction.userSide
    const isUserPro = userSide === "PRO"

    const judgesName = `${judge?.firstName} ${judge?.lastName}`
    const leadsName = `${lead?.firstName} ${lead?.lastName}`
    const deputysName = `${deputy?.firstName} ${deputy?.lastName}`
    const whipsName = `${whip?.firstName} ${whip?.lastName}`

    // System prompt for the Debate Judge/Opponent
    const systemPrompt = `
You are an expert Debate Judge and a team of 3 debaters.
The motion is: "${motion}"
Context: ${extraInfo}

THE CHARACTERS:
JUDGE: ${judgesName}.

AFFIRMATIVE TEAM:
1. Prime Minister: ${isUserPro ? userName : leadsName}
2. Deputy Prime Minister: ${isUserPro ? userName : deputysName}
3. Rebuttal Speaker: ${isUserPro ? userName : whipsName}

NEGATIVE TEAM:
1. Leader of Opposition: ${isUserPro ? leadsName : userName}
2. Deputy Leader of Opposition: ${isUserPro ? deputysName : userName}
3. Opposition Whip: ${isUserPro ? whipsName : userName}

DEBATE STRUCTURE & TURN ORDER:
- Every debater's turn MUST be preceded by a brief transition/invitation from the JUDGE.
- The full sequence is:
  1. JUDGE opens the debate and invites the Prime Minister.
  2. Prime Minister speaks.
  3. JUDGE reflects briefly and invites the Leader of Opposition.
  4. Leader of Opposition speaks.
  5. JUDGE invites the Deputy Prime Minister.
  6. Deputy Prime Minister speaks.
  7. JUDGE invites the Deputy Leader of Opposition.
  8. Deputy Leader of Opposition speaks.
  9. JUDGE invites the Affirmative Rebuttal.
  10. Affirmative Rebuttal speaks.
  11. JUDGE invites the Opposition Whip.
  12. Opposition Whip speaks.
  13. JUDGE declares the winner and provides a summary.

USER SIDE: You are on the ${isUserPro ? "AFFIRMATIVE" : "NEGATIVE"} team.
AI SIDE: You play the Judge and the speakers for the ${isUserPro ? "NEGATIVE" : "AFFIRMATIVE"} team.

YOUR ROLES:
- You play the JUDGE (${judgesName}) and the three speakers on the ${isUserPro ? "NEGATIVE" : "AFFIRMATIVE"} team.
- YOU ARE STRICTLY FORBIDDEN from generating dialogue for any character on the User's team.
- AFTER every speaker (AI or User) finishes, the JUDGE MUST speak to invite the next person.
- If the next person to speak is on the User's team, the JUDGE must invite them and you MUST set "isUsersTurn": true and stop.
- AI NEVER generates a speech for a character on the User's team.
- ALWAYS respond as ONLY ONE character at a time. Do not combine the Judge and a debater in one response.
- LENGTH LIMIT: Keep speeches and transitions under 1200 characters. 
- JSON ESCAPING: Use \\n for newlines. No raw newlines in JSON strings.

You MUST respond with a valid JSON object matching the following structure. NO markdown formatting, NO preamble.
 { 
   "text": string, 
   "speakerName": string, 
   "speakerTitle": string, 
   "status": "IN_PROGRESS" | "COMPLETED", 
   "isUsersTurn": boolean,
   "evaluation": {
    "feedback": "Detailed feedback for the LAST user message in terms of argument strength, logic, and delivery.",
    "metrics": {
      "correctness": 0-100,
      "clarity": 0-100,
      "relevance": 0-100,
      "detail": 0-100,
      "efficiency": 0-100,
      "creativity": 0-100,
      "communication": 0-100,
      "problemSolving": 0-100
    }
  } | null
 }
 Set evaluation to null if the last speaker was AI.
`

    const coreMessages = (
      messages as {
        role: string
        parts?:
          | string
          | {
              type: string
              text?: string
              speakerName?: string
              speakerTitle?: string
            }[]
        content?: string
        speakerName?: string
        speakerTitle?: string
      }[]
    ).map((m) => {
      const parts = m.parts || m.content
      const textPart = Array.isArray(parts)
        ? (
            parts as {
              type: string
              text: string
              speakerName?: string
              speakerTitle?: string
            }[]
          ).find((p) => p.type === "text")
        : null
      const text = textPart
        ? textPart.text
        : typeof parts === "string"
          ? parts
          : ""
      const speakerName =
        textPart?.speakerName ||
        m.speakerName ||
        (m.role === "user" ? userName : "AI")
      const speakerTitle =
        textPart?.speakerTitle ||
        m.speakerTitle ||
        (m.role === "user"
          ? isUserPro
            ? "Prime Minister"
            : "Leader of Opposition"
          : "Speaker")

      return {
        role: m.role,
        content: `${speakerName} (${speakerTitle}): ${text}`,
        speakerName,
        speakerTitle,
      }
    })

    const rolesSequence = [
      { id: 1, speaker: judge, role: "Judge", title: "Judge Opening" },
      {
        id: 2,
        speaker: isUserPro ? { firstName: userName, id: "user" } : lead,
        role: "Prime Minister",
        title: "Prime Minister Speech",
      },
      {
        id: 3,
        speaker: judge,
        role: "Judge",
        title: "Judge Transition to Lead Opponent",
      },
      {
        id: 4,
        speaker: isUserPro ? lead : { firstName: userName, id: "user" },
        role: "Leader of Opposition",
        title: "Leader of Opposition Speech",
      },
      {
        id: 5,
        speaker: judge,
        role: "Judge",
        title: "Judge Transition to Deputy PM",
      },
      {
        id: 6,
        speaker: isUserPro ? { firstName: userName, id: "user" } : deputy,
        role: "Deputy Prime Minister",
        title: "Deputy Prime Minister Speech",
      },
      {
        id: 7,
        speaker: judge,
        role: "Judge",
        title: "Judge Transition to Deputy LO",
      },
      {
        id: 8,
        speaker: isUserPro ? deputy : { firstName: userName, id: "user" },
        role: "Deputy Leader of Opposition",
        title: "Deputy Leader of Opposition Speech",
      },
      {
        id: 9,
        speaker: judge,
        role: "Judge",
        title: "Judge Transition to Affirmative Rebuttal",
      },
      {
        id: 10,
        speaker: isUserPro ? { firstName: userName, id: "user" } : whip,
        role: "Affirmative Rebuttal",
        title: "Affirmative Rebuttal Speech",
      },
      {
        id: 11,
        speaker: judge,
        role: "Judge",
        title: "Judge Transition to Opposition Whip",
      },
      {
        id: 12,
        speaker: isUserPro ? whip : { firstName: userName, id: "user" },
        role: "Opposition Whip",
        title: "Opposition Whip Speech",
      },
      {
        id: 13,
        speaker: judge,
        role: "Judge",
        title: "Judge Closing & Winner",
      },
    ]

    const turnIndex = coreMessages.length
    const currentStep =
      rolesSequence[turnIndex] || rolesSequence[rolesSequence.length - 1]

    // Logic for setting isUsersTurn:
    // It should be true IF the VERY NEXT turn in the sequence belongs to the User.
    const nextStep =
      turnIndex + 1 < rolesSequence.length ? rolesSequence[turnIndex + 1] : null
    const willNextBeUser = nextStep?.speaker?.firstName === userName

    let stepInstruction = `\nSTRICT INSTRUCTION FOR CURRENT REQUEST:\n`
    stepInstruction += `- You are performing STEP ${turnIndex + 1} of 13: "${currentStep.title}".\n`
    stepInstruction += `- YOU MUST PLAY THE ROLE OF: ${currentStep.speaker?.firstName || "AI"} in the capacity of ${currentStep.role}.\n`

    if (
      (currentStep.speaker as { firstName: string })?.firstName === userName
    ) {
      // If we got here, it means the auto-trigger or a direct call reached a user step.
      // We MUST NOT generate text. The Judge already invited them in the previous turn.
      return NextResponse.json({
        text: "",
        speakerName: judgesName,
        speakerTitle: "Judge",
        isUsersTurn: true,
        status: "IN_PROGRESS",
      })
    } else {
      const speakerFirstName =
        (currentStep.speaker as { firstName: string })?.firstName || "AI"
      const speakerLastName =
        (currentStep.speaker as { lastName?: string })?.lastName || ""
      stepInstruction += `- set "isUsersTurn": ${willNextBeUser ? "true" : "false"}.\n`
      stepInstruction += `- You are currently ${speakerFirstName} ${speakerLastName}.\n`
    }

    if (turnIndex >= 12) {
      stepInstruction += `- set "status": "COMPLETED".`
    } else {
      stepInstruction += `- set "status": "IN_PROGRESS".`
    }

    if (turnIndex === 0) {
      coreMessages.push({
        role: "user",
        content: "The debate is live. Proceed with Step 1: Judge Opening.",
        speakerName: "System",
        speakerTitle: "System",
      })
    } else if (coreMessages[coreMessages.length - 1].role === "assistant") {
      coreMessages.push({
        role: "user",
        content: `Step ${turnIndex} completed. Next is Step ${turnIndex + 1}: ${currentStep.title}. Proceed.`,
        speakerName: "System",
        speakerTitle: "System",
      })
    }

    const fullSystemPrompt = `${systemPrompt}\n${stepInstruction}`

    const responseData = await aiService.generateObject({
      messages: [
        { role: "system", content: fullSystemPrompt },
        ...coreMessages.map((m) => ({ role: m.role, content: m.content })),
      ],
      outputSchema: DebateResponseSchema,
    })

    // Save user message if the last message in the array is from the user
    let userMessageId: string | undefined = undefined
    if (messages.length > 0) {
      const lastUserMessage = messages[messages.length - 1]
      if (lastUserMessage.role === "user") {
        const savedUserMsg = await prisma.message.create({
          data: {
            role: "user",
            parts: [
              {
                type: "text",
                text: Array.isArray(lastUserMessage.parts)
                  ? (lastUserMessage.parts as { type: string; text: string }[])
                      .filter((p) => p.type === "text")
                      .map((p) => p.text)
                      .join("\n")
                  : lastUserMessage.parts || lastUserMessage.content,
                speakerName: lastUserMessage.speakerName || "You",
                speakerTitle: lastUserMessage.speakerTitle || "Speaker",
                isUsersTurn: false,
                audio: {
                  url: audioUrl || null,
                  publicId: audioPublicId || null,
                },
              },
            ],
            interactionId: sessionId,
          },
        })
        userMessageId = savedUserMsg.id
      }
    }

    // Generate Speech for the AI response
    // Find the character model based on speakerName
    const currentSpeakerChar = CHARACTERS.find(
      (c) => `${c.firstName} ${c.lastName}` === responseData.speakerName,
    )
    const speakerModel = currentSpeakerChar?.model || "luna"

    let audioData = null
    let signedUrl = null
    try {
      audioData = await aiService.textToSpeech(responseData.text, speakerModel)
      signedUrl = await getSignedDownloadUrl(audioData.path)
    } catch (err) {
      console.error("TTS Error in Debate API:", err)
    }

    // Save AI response
    await prisma.message.create({
      data: {
        role: "assistant",
        parts: [
          {
            type: "text",
            text: responseData.text,
            speakerName: responseData.speakerName,
            speakerTitle: responseData.speakerTitle,
            isUsersTurn: !!responseData.isUsersTurn,
            audio: {
              url: signedUrl || null,
              path: audioData?.path || null,
            },
          },
        ],
        interactionId: sessionId,
      },
    })

    // Update session status and duration
    await prisma.agentInteraction.update({
      where: { id: sessionId },
      data: {
        status:
          responseData.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
        duration: duration || 0,
      },
    })

    // If there's an evaluation, update the last user message and session metrics
    if (responseData.evaluation) {
      const lastUserMsg = await prisma.message.findFirst({
        where: {
          interactionId: sessionId,
          role: "user",
        },
        orderBy: { createdAt: "desc" },
      })

      if (lastUserMsg) {
        await prisma.message.update({
          where: { id: lastUserMsg.id },
          data: {
            feedback: responseData.evaluation.feedback,
            metrics: {
              upsert: {
                create: { ...responseData.evaluation.metrics },
                update: { ...responseData.evaluation.metrics },
              },
            },
          },
        })

        // Calculate new averages
        const allUserMessages = await prisma.message.findMany({
          where: {
            interactionId: sessionId,
            role: "user",
            metrics: { isNot: null },
          },
          include: { metrics: true },
        })

        if (allUserMessages.length > 0) {
          const metrics = [
            "correctness",
            "clarity",
            "relevance",
            "detail",
            "efficiency",
            "creativity",
            "communication",
            "problemSolving",
          ]

          const averages: Record<string, number> = {}
          metrics.forEach((metric) => {
            const sum = allUserMessages.reduce((acc, msg) => {
              const val = msg.metrics
                ? (msg.metrics[metric as keyof typeof msg.metrics] as number)
                : 0
              return acc + (val || 0)
            }, 0)
            averages[metric] = Math.round(sum / allUserMessages.length)
          })

          await prisma.agentInteraction.update({
            where: { id: sessionId },
            data: {
              metrics: {
                upsert: {
                  create: { ...averages },
                  update: { ...averages },
                },
              },
            },
          })
        }
      }
    }

    return NextResponse.json({
      ...responseData,
      audioUrl: signedUrl,
      userMessageId,
    })
  } catch (error) {
    console.error("Error in debate chat:", error)
    return NextResponse.json(
      { error: "Failed to process debate step" },
      { status: 500 },
    )
  }
}
