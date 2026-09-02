/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"

type EditablePart = { type: "text" | "reasoning"; text: string; id: string }

function truncate(text: string, max: number): string {
  const oneline = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim()
  if (oneline.length <= max) return oneline
  return oneline.slice(0, max - 1) + "…"
}

function errText(e: unknown): string {
  const anyE = e as { data?: { message?: string }; message?: string }
  return anyE?.data?.message || anyE?.message || JSON.stringify(e)
}

const tui: TuiPlugin = async (api) => {
  const runGaslight = async () => {
    {
      const route = api.route.current
      if (route.name !== "session") {
        api.ui.toast({ message: "No active session", variant: "error" })
        return
      }

      const sessionID = route.params.sessionID
      const messages = api.state.session.messages(sessionID)
      const assistantMsgs = messages.filter((m) => m.role === "assistant")

      if (assistantMsgs.length === 0) {
        api.ui.toast({ message: "No assistant messages found", variant: "error" })
        return
      }

        const options: {
          title: string
          value: string
          description: string
        }[] = []

        assistantMsgs.forEach((msg, idx) => {
          const parts = api.state.part(msg.id)
          const textParts = parts.filter((p) => p.type === "text") as EditablePart[]
          const reasoningParts = parts.filter(
            (p) => p.type === "reasoning",
          ) as EditablePart[]
          const hasText = textParts.some((p) => p.text.trim().length > 0)
          const hasReasoning = reasoningParts.some((p) => p.text.trim().length > 0)

          if (!hasText && !hasReasoning) return

          const fullText = textParts.map((p) => p.text).join("")
          const fullThinking = reasoningParts.map((p) => p.text).join("")

          if (hasText) {
            options.push({
              title: `Response #${idx + 1}`,
              value: `text:${msg.id}`,
              description: truncate(fullText, 90),
            })
          }
          if (hasReasoning) {
            options.push({
              title: `Thinking #${idx + 1}`,
              value: `think:${msg.id}`,
              description: truncate(fullThinking, 90),
            })
          }
        })

        options.reverse()

        if (options.length === 0) {
          api.ui.toast({ message: "No editable content found", variant: "error" })
          return
        }


        if (options.length === 1) {
          openEditor(sessionID, options[0].value)
          return
        }

        const lastMsgId = assistantMsgs[assistantMsgs.length - 1].id

        api.ui.dialog.setSize("large")
        api.ui.dialog.replace(
          () =>
            api.ui.DialogSelect({
              title: "Select content to edit (type a number to filter, then Enter)",
              placeholder: "Type e.g. 88 to filter Response #88…",
              options,
              current: `text:${lastMsgId}`,
              onSelect: (option) => {
                openEditor(sessionID, option.value as string)
              },
            }),
          () => {},
        )
    }
  }

  const runGasdel = async () => {
    {
      const route = api.route.current
      if (route.name !== "session") {
        api.ui.toast({ message: "No active session", variant: "error" })
        return
      }

      const sessionID = route.params.sessionID
      const messages = api.state.session.messages(sessionID)
      const assistantMsgs = messages.filter((m) => m.role === "assistant")

      if (assistantMsgs.length === 0) {
        api.ui.toast({ message: "No assistant messages found", variant: "error" })
        return
      }

        const options = assistantMsgs
          .map((msg, idx) => {
            const parts = api.state.part(msg.id)
            const textParts = parts.filter((p) => p.type === "text") as EditablePart[]
            const reasoningParts = parts.filter(
              (p) => p.type === "reasoning",
            ) as EditablePart[]
            const hasText = textParts.some((p) => p.text.trim().length > 0)
            const hasReasoning = reasoningParts.some((p) => p.text.trim().length > 0)

            if (!hasText && !hasReasoning) return null

            const fullText = textParts.map((p) => p.text).join("")
            const badge = hasReasoning ? " [has thinking]" : ""
            const preview =
              fullText.length > 0
                ? truncate(fullText, 90) + badge
                : "(thinking only)" + badge

            return {
              title: `Response #${idx + 1}`,
              value: msg.id,
              description: preview,
            }
          })
          .filter((o): o is NonNullable<typeof o> => o !== null)
          .reverse()

        if (options.length === 0) {
          api.ui.toast({ message: "No editable content found", variant: "error" })
          return
        }

        const lastMsgId = assistantMsgs[assistantMsgs.length - 1].id


        api.ui.dialog.setSize("large")
        api.ui.dialog.replace(
          () =>
            api.ui.DialogSelect({
              title: "Select response to DELETE (type a number to filter, then Enter)",
              placeholder: "Type e.g. 88 to filter Response #88…",
              options,
              current: lastMsgId,
              onSelect: (option) => {
                confirmDelete(sessionID, option.value as string)
              },
            }),
          () => {},
        )
    }
  }

  // Register via modern keymap API: enabled must be a FUNCTION so it is
  // re-evaluated dynamically (legacy api.command.register freezes the value).
  api.keymap.registerLayer({
    commands: [
      {
        name: "plugin.gaslight",
        title: "Gaslight",
        desc: "Edit an assistant response or thinking in this session",
        category: "Session",
        namespace: "palette",
        slashName: "gaslight",
        enabled: () => api.route.current.name === "session",
        run: () => runGaslight(),
      },
      {
        name: "plugin.gaslight-delete",
        title: "Gaslight Delete",
        desc: "Delete an assistant response from this session",
        category: "Session",
        namespace: "palette",
        slashName: "gasdel",
        slashAliases: ["gaslight-delete"],
        enabled: () => api.route.current.name === "session",
        run: () => runGasdel(),
      },
    ],
  })

  // ── Open single-field editor for response or thinking ──────────────

  function openEditor(sessionID: string, target: string) {
    const kind = target.startsWith("think:") ? "thinking" : "response"
    const messageID = target.slice(kind === "thinking" ? 6 : 5)
    const messages = api.state.session.messages(sessionID)
    const message = messages.find((m) => m.id === messageID)
    if (!message) {
      api.ui.toast({ message: "Message not found", variant: "error" })
      return
    }

    const parts = api.state.part(message.id)
    const targetParts = (
      kind === "thinking"
        ? parts.filter((p) => p.type === "reasoning")
        : parts.filter((p) => p.type === "text")
    ) as EditablePart[]
    const usable = targetParts.filter((p) => p.text.trim().length > 0)


    if (usable.length === 0) {
      api.ui.toast({ message: "No editable content", variant: "error" })
      return
    }

    const originalText = usable.map((p) => p.text).join("")
    const label = kind === "thinking" ? "Thinking" : "Response"

    api.ui.dialog.setSize("medium")
    api.ui.dialog.replace(
      () =>
        api.ui.DialogPrompt({
          title: `Edit ${label}`,
          value: originalText,
          placeholder: `Enter corrected ${label.toLowerCase()}`,
          onConfirm: async (newText: string) => {
            api.ui.dialog.clear()
            if (newText === originalText) {
              api.ui.toast({ message: "No changes made", variant: "info" })
              return
            }
            try {
              await saveParts(sessionID, messageID, usable, newText)
              api.ui.toast({ message: `${label} updated`, variant: "success" })
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Failed to update"
              api.ui.toast({ message: msg, variant: "error" })
            }
          },
          onCancel: () => api.ui.dialog.clear(),
        }),
      () => {},
    )
  }

  // ── Confirm and delete an entire message ───────────────────────────

  async function confirmDelete(sessionID: string, messageID: string) {
    api.ui.dialog.setSize("medium")
    api.ui.dialog.replace(
      () =>
        api.ui.DialogConfirm({
          title: "Delete response?",
          message:
            "This permanently removes the message and all its parts from this session.",
          onConfirm: async () => {
            api.ui.dialog.clear()
            try {
              const res = await api.client.session.deleteMessage({
                sessionID,
                messageID,
              })
              if (res?.error) throw new Error(errText(res.error))
              api.ui.toast({ message: "Response deleted", variant: "success" })
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Failed to delete"
              api.ui.toast({ message: msg, variant: "error" })
            }
          },
          onCancel: () => api.ui.dialog.clear(),
        }),
      () => {},
    )
  }

  // ── Persist part updates ───────────────────────────────────────────

  async function saveParts(
    sessionID: string,
    messageID: string,
    parts: EditablePart[],
    newText: string,
  ) {
    const first = parts[0]
    const res1 = await api.client.part.update({
      sessionID,
      messageID,
      partID: first.id,
      part: { ...first, text: newText },
    })
    if (res1?.error) throw new Error(errText(res1.error))
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]
      const res = await api.client.part.update({
        sessionID,
        messageID,
        partID: part.id,
        part: { ...part, text: "" },
      })
      if (res?.error) throw new Error(errText(res.error))
    }
  }
}

const plugin: TuiPluginModule & { id: string } = {
  id: "opencode-gaslight",
  tui,
}

export default plugin
