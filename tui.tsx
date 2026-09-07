/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"

type EditablePart = { type: "text" | "reasoning"; text: string; id: string }
type MsgEntry = { info: any; parts: any[] }

function truncate(text: string, max: number): string {
  const oneline = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim()
  if (oneline.length <= max) return oneline
  return oneline.slice(0, max - 1) + "…"
}

function errText(e: unknown): string {
  const anyE = e as { data?: { message?: string }; message?: string }
  return anyE?.data?.message || anyE?.message || JSON.stringify(e)
}

function formatTime(ts: number | undefined): string {
  if (!ts) return "unknown time"
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return "unknown time"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const tui: TuiPlugin = async (api) => {
  // ── Session resolution: current route first, otherwise pick from all ──

  function currentSessionID(): string | undefined {
    const route = api.route.current as unknown as {
      name: string
      params?: { sessionID?: string }
    }
    if (route.name === "session") return route.params?.sessionID
    return undefined
  }

  async function fetchAllSessions(): Promise<
    { id: string; title: string; directory: string; updated: number }[]
  > {
    try {
      const res = (await (api.client.session as any).list({
        limit: 100,
      })) as { data?: any[]; error?: unknown }
      if (res?.error) throw new Error(errText(res.error))
      const list = res?.data ?? []
      return list.map((s: any) => ({
        id: s.id as string,
        title: (s.title as string) || "(untitled)",
        directory: (s.directory as string) || "",
        updated: (s.time?.updated as number) || (s.time?.created as number) || 0,
      }))
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err))
    }
  }

  // Fetch messages + parts for ANY session via client API (works for
  // background / inactive sessions, unlike api.state cache which only
  // holds the currently open session).
  async function fetchEntries(sessionID: string): Promise<MsgEntry[]> {
    try {
      const res = (await (api.client.session as any).messages({
        sessionID,
      })) as { data?: MsgEntry[]; error?: unknown }
      if (res?.error) throw new Error(errText(res.error))
      if (Array.isArray(res?.data)) return res.data as MsgEntry[]
    } catch {
      // fall through to state-cache fallback below
    }
    // Fallback: TUI state cache (only populated for active session)
    try {
      const messages = api.state.session.messages(sessionID) as any[]
      return messages.map((m: any) => {
        let parts: any[] = []
        try {
          parts = api.state.part(m.id) as any[]
        } catch {
          parts = []
        }
        return { info: m, parts }
      })
    } catch {
      return []
    }
  }

  function pickSession(
    title: string,
    placeholder: string,
    onPick: (sessionID: string) => void,
  ) {
    fetchAllSessions()
      .then((sessions) => {
        if (sessions.length === 0) {
          api.ui.toast({ message: "No sessions found", variant: "error" })
          return
        }
        if (sessions.length === 1) {
          onPick(sessions[0].id)
          return
        }
        const cur = currentSessionID()
        const options = sessions.map((s) => ({
          title: truncate(s.title, 60),
          value: s.id,
          description: `${s.directory} · ${formatTime(s.updated)}`,
        }))
        api.ui.dialog.setSize("large")
        api.ui.dialog.replace(
          () =>
            api.ui.DialogSelect({
              title,
              placeholder,
              options,
              current: cur,
              onSelect: (option) => {
                onPick(option.value as string)
              },
            }),
          () => {},
        )
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to list sessions"
        api.ui.toast({ message: msg, variant: "error" })
      })
  }

  // ── Entry points (global: work from home screen too) ─────────────

  const runGaslight = async () => {
    const sid = currentSessionID()
    if (sid) {
      await gaslightInSession(sid)
      return
    }
    pickSession(
      "Select session to gaslight (type to filter, then Enter)",
      "Type session title to filter…",
      (picked) => gaslightInSession(picked),
    )
  }

  const runGasdel = async () => {
    const sid = currentSessionID()
    if (sid) {
      await gasdelInSession(sid)
      return
    }
    pickSession(
      "Select session to delete from (type to filter, then Enter)",
      "Type session title to filter…",
      (picked) => gasdelInSession(picked),
    )
  }

  async function gaslightInSession(sessionID: string) {
    const entries = await fetchEntries(sessionID)
    const assistantEntries = entries.filter((e) => e.info?.role === "assistant")

    if (assistantEntries.length === 0) {
      api.ui.toast({ message: "No assistant messages found", variant: "error" })
      return
    }

    const options: {
      title: string
      value: string
      description: string
    }[] = []

    assistantEntries.forEach((entry, idx) => {
      const parts = entry.parts ?? []
      const textParts = parts.filter((p) => p.type === "text") as EditablePart[]
      const reasoningParts = parts.filter(
        (p) => p.type === "reasoning",
      ) as EditablePart[]
      const hasText = textParts.some((p) => (p.text ?? "").trim().length > 0)
      const hasReasoning = reasoningParts.some(
        (p) => (p.text ?? "").trim().length > 0,
      )

      if (!hasText && !hasReasoning) return

      const fullText = textParts.map((p) => p.text ?? "").join("")
      const fullThinking = reasoningParts.map((p) => p.text ?? "").join("")

      if (hasText) {
        options.push({
          title: `Response #${idx + 1}`,
          value: `text:${entry.info.id}`,
          description: truncate(fullText, 90),
        })
      }
      if (hasReasoning) {
        options.push({
          title: `Thinking #${idx + 1}`,
          value: `think:${entry.info.id}`,
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

    const lastId =
      assistantEntries[assistantEntries.length - 1]?.info?.id ?? ""

    api.ui.dialog.setSize("large")
    api.ui.dialog.replace(
      () =>
        api.ui.DialogSelect({
          title: "Select content to edit (type a number to filter, then Enter)",
          placeholder: "Type e.g. 88 to filter Response #88…",
          options,
          current: `text:${lastId}`,
          onSelect: (option) => {
            openEditor(sessionID, option.value as string)
          },
        }),
      () => {},
    )
  }

  async function gasdelInSession(sessionID: string) {
    const entries = await fetchEntries(sessionID)
    const assistantEntries = entries.filter((e) => e.info?.role === "assistant")

    if (assistantEntries.length === 0) {
      api.ui.toast({ message: "No assistant messages found", variant: "error" })
      return
    }

    const options = assistantEntries
      .map((entry, idx) => {
        const parts = entry.parts ?? []
        const textParts = parts.filter((p) => p.type === "text") as EditablePart[]
        const reasoningParts = parts.filter(
          (p) => p.type === "reasoning",
        ) as EditablePart[]
        const hasText = textParts.some((p) => (p.text ?? "").trim().length > 0)
        const hasReasoning = reasoningParts.some(
          (p) => (p.text ?? "").trim().length > 0,
        )

        if (!hasText && !hasReasoning) return null

        const fullText = textParts.map((p) => p.text ?? "").join("")
        const badge = hasReasoning ? " [has thinking]" : ""
        const preview =
          fullText.length > 0
            ? truncate(fullText, 90) + badge
            : "(thinking only)" + badge

        return {
          title: `Response #${idx + 1}`,
          value: entry.info.id as string,
          description: preview,
        }
      })
      .filter((o): o is NonNullable<typeof o> => o !== null)
      .reverse()

    if (options.length === 0) {
      api.ui.toast({ message: "No editable content found", variant: "error" })
      return
    }

    const lastId =
      assistantEntries[assistantEntries.length - 1]?.info?.id ?? ""

    api.ui.dialog.setSize("large")
    api.ui.dialog.replace(
      () =>
        api.ui.DialogSelect({
          title: "Select response to DELETE (type a number to filter, then Enter)",
          placeholder: "Type e.g. 88 to filter Response #88…",
          options,
          current: lastId,
          onSelect: (option) => {
            confirmDelete(sessionID, option.value as string)
          },
        }),
      () => {},
    )
  }

  // Register globally: visible on home screen AND inside sessions.
  // enabled is a FUNCTION so it re-evaluates dynamically (legacy
  // api.command.register freezes the value at load time).
  api.keymap.registerLayer({
    commands: [
      {
        name: "plugin.gaslight",
        title: "Gaslight",
        desc: "Edit an assistant response or thinking in any session",
        category: "Session",
        namespace: "palette",
        slashName: "gaslight",
        enabled: () => true,
        run: () => runGaslight(),
      },
      {
        name: "plugin.gaslight-delete",
        title: "Gaslight Delete",
        desc: "Delete an assistant response from any session",
        category: "Session",
        namespace: "palette",
        slashName: "gasdel",
        slashAliases: ["gaslight-delete"],
        enabled: () => true,
        run: () => runGasdel(),
      },
    ],
  })

  // ── Open single-field editor for response or thinking ──────────────

  async function openEditor(sessionID: string, target: string) {
    const kind = target.startsWith("think:") ? "thinking" : "response"
    const messageID = target.slice(kind === "thinking" ? 6 : 5)

    // Re-fetch so we edit fresh parts even for background sessions.
    const entries = await fetchEntries(sessionID)
    const entry = entries.find((e) => e.info?.id === messageID)
    if (!entry) {
      api.ui.toast({ message: "Message not found", variant: "error" })
      return
    }

    const parts = entry.parts ?? []
    const targetParts = (
      kind === "thinking"
        ? parts.filter((p) => p.type === "reasoning")
        : parts.filter((p) => p.type === "text")
    ) as EditablePart[]
    const usable = targetParts.filter((p) => (p.text ?? "").trim().length > 0)

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
              if ((res as any)?.error) throw new Error(errText((res as any).error))
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
      part: { ...first, text: newText } as any,
    })
    if ((res1 as any)?.error) throw new Error(errText((res1 as any).error))
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]
      const res = await api.client.part.update({
        sessionID,
        messageID,
        partID: part.id,
        part: { ...part, text: "" } as any,
      })
      if ((res as any)?.error) throw new Error(errText((res as any).error))
    }
  }
}

const plugin: TuiPluginModule & { id: string } = {
  id: "opencode-gaslight",
  tui,
}

export default plugin
