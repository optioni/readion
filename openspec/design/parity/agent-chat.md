# Parity — Agent chat

9 findings — 2 high · 5 medium · 2 low

- **[high] Full-height chat shell (header pinned top / messages scroll / input pinned bottom)** — divergent/layout
  - design: ChatPage is a full-height flex column edge-to-edge inside the content area: fixed 52px header flush to the top border, a flex:1 scrollable message region, and an InputBar flush to the bottom — no outer page padding (Artboard height 740, ChatPage `height:'100%'`, openspec/design/AgentChat.html:212-237).
  - app: apps/web/app/pages/agent.vue has no `definePageMeta({ layout: ... })`, so it resolves to the default layout, whose `<main>` wraps page content in `px-4 py-8 sm:px-6 lg:px-10` padding and is not height-constrained (apps/web/app/layouts/default.vue:41-43). Comparable full-screen interactive scenes (session runner, mock exam) explicitly opt into `layout: 'minimal'` to avoid this (apps/web/app/pages/sessions/[id]/index.vue:18, apps/web/app/pages/mock-exams/[id]/index.vue:6) but agent.vue does not, so the chat panel is boxed in page padding and the whole page scrolls instead of only the message list.
  - evidence: `openspec/design/AgentChat.html:212-237 vs apps/web/app/pages/agent.vue (no definePageMeta) + apps/web/app/layouts/default.vue:41-43`
- **[high] User/assistant bubble color scheme** — divergent/composition
  - design: Per the artboard subtitle: "User bubbles: surface + secondary text. Agent bubbles: primary.default + white." UserBubble uses `T.surface` bg + `T.tSecond` text (openspec/design/AgentChat.html:119-125); AssistantBubble uses `T.primary` bg + white text (openspec/design/AgentChat.html:132-146).
  - app: The roles are swapped: the user bubble is styled `border-readion-primary bg-readion-primary text-white` and the assistant bubble is styled `border-readion-border-strong bg-readion-background-surface text-readion-text-secondary` — the exact inverse of the design intent.
  - evidence: `openspec/design/AgentChat.html:119-146 (subtitle at line 299) vs apps/web/app/components/AgentBubble.vue:32-40`
- **[medium] Per-message assistant avatar** — missing/composition
  - design: Every AssistantBubble instance is preceded by a 28x28 circular sparkle-icon avatar rendered inline beside the bubble (openspec/design/AgentChat.html:134-136).
  - app: AgentBubble.vue renders only a small text label "Study assistant" above non-user bubbles; there is no avatar icon per message (the AgentStarAvatar component is only used in the page header and empty state, not per-turn).
  - evidence: `openspec/design/AgentChat.html:132-146 vs apps/web/app/components/AgentBubble.vue:28-30`
- **[medium] Streaming cursor placement/color** — divergent/behavioral
  - design: The blinking cursor is rendered inline at the end of the last paragraph's text, inside the primary-colored bubble, colored white (`rgba(255,255,255,0.8)`) (openspec/design/AgentChat.html:24, 141).
  - app: The cursor is a separate sibling block rendered after the entire message list (`v-if="isStreaming"`), not inside the last bubble/paragraph, and colored `bg-readion-text-muted` rather than white-on-primary.
  - evidence: `openspec/design/AgentChat.html:24,132-146 vs apps/web/app/pages/agent.vue:138-144`
- **[medium] Assistant message paragraph spacing** — simplified/composition
  - design: AssistantBubble content is split into discrete `<p>` paragraphs (AssistantPara) each with `marginBottom:10`, giving visible spacing between argument chunks (openspec/design/AgentChat.html:128-146).
  - app: hydrateAgentMessages/useStandaloneAgentChat store the whole turn as one concatenated `content` string, rendered as a single `<p class="whitespace-pre-wrap">` with no paragraph-level spacing.
  - evidence: `openspec/design/AgentChat.html:128-146 vs apps/web/app/composables/agentMessages.ts:25-33 and apps/web/app/components/AgentBubble.vue:40`
- **[medium] Send button active/inactive state** — divergent/behavioral
  - design: Send button background is conditional on textarea content: `background: value ? T.primary : T.border` — greyed out until text is entered (openspec/design/AgentChat.html:159).
  - app: Send button is always `bg-readion-primary`; it is only disabled via `:disabled="isStreaming"`, with no empty-input styling/disable state.
  - evidence: `openspec/design/AgentChat.html:159 vs apps/web/app/pages/agent.vue:159-165`
- **[medium] TTL indicator clock icon** — simplified/composition
  - design: TTL pill includes a small clock/stopwatch SVG icon alongside the remaining-time text (openspec/design/AgentChat.html:105).
  - app: The ttl chip (`data-testid="agent-ttl-chip"`) renders only the text string inside a bordered pill, no icon.
  - evidence: `openspec/design/AgentChat.html:103-110 vs apps/web/app/pages/agent.vue:60-63`
- **[low] New chat button icon** — simplified/composition
  - design: "New chat" button includes a counter-clockwise-arrow refresh SVG icon before the label (openspec/design/AgentChat.html:111-114).
  - app: The new-chat button (`data-testid="agent-new-chat-button"`) renders only the text "New chat", no icon.
  - evidence: `openspec/design/AgentChat.html:111-114 vs apps/web/app/pages/agent.vue:64-71`
- **[low] Input placeholder wording** — divergent/composition
  - design: Placeholder text uses an ellipsis character: "Ask anything…" (openspec/design/AgentChat.html:154).
  - app: Placeholder uses three literal dots: "Ask anything..."
  - evidence: `openspec/design/AgentChat.html:154 vs apps/web/app/pages/agent.vue:155`
