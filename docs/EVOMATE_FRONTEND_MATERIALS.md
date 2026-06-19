# EvoMate Frontend Materials

## Target Visual

EvoMate should look like a high-end AI evolution cockpit, not a normal SaaS dashboard.

Keywords:

```text
Personal AI memory core
AI identity cockpit
dark glassmorphism
purple / cyan / mint glow
behavior genome
agent evolution timeline
MCP trace graph
```

## Primary References

### 1. Personal AI — Memory Core / Identity Language

URL: https://www.personal.ai/

Use for:

- Memory Core language
- identity-centered AI visual
- circular core diagram
- memory/context/identity concept copy
- premium enterprise AI feel

Important idea:

```text
Memory + Context + Identity -> evolving AI
```

For EvoMate, translate this to:

```text
Feedback + Behavior Gene + GEP Memory -> evolving Yes Engineer
```

### 2. Aceternity UI — Futuristic Effects

URL: https://ui.aceternity.com/

Useful components:

- Background Beams
- Aurora Background
- Sparkles
- Glowing Effect
- Bento Grid
- Timeline
- World Map / Globe
- Moving Border
- Glare Card
- 3D Pin

Use for:

- hero background
- animated beams between user / ML / EvoMap / worker nodes
- glass cards
- high-end landing/dashboard effects

### 3. Magic UI — Animated AI Interface Components

URL: https://magicui.design/

Useful components:

- Animated Beam
- Particles
- Border Beam
- Shine Border
- Magic Card
- Orbiting Circles
- Number Ticker
- Animated List
- Grid Pattern
- Dot Pattern

Use for:

- MCP connection animation
- signal-to-gene beam
- Yesness number animation
- Memory Core particles

### 4. shadcn/ui Blocks — Dashboard Structure

URL: https://ui.shadcn.com/blocks

Use for:

- sidebar layout
- dashboard cards
- chart blocks
- data tables
- clean React/Tailwind base

shadcn should provide structure; Aceternity/Magic UI should provide spectacle.

### 5. Tremor — Data Dashboard / Metrics

URL: https://www.tremor.so/

Use for:

- Yesness score charts
- reward trend
- correction/interruption metrics
- policy weight visualization

### 6. 21st.dev — Community Component Discovery

URL: https://21st.dev/community/components

Use for:

- AI chat components
- hero sections
- shader/background inspiration
- one-off UI patterns

### 7. Linear — Product System Polish

URL: https://linear.app/

Use for:

- serious product dashboard feel
- agent + human workflow visuals
- compact issue/activity rows
- high information density without looking messy

## Recommended EvoMate UI Composition

```text
Full screen dark cockpit
├─ Top: product status / EvoMap status / generation / Yesness
├─ Left: user interaction + feedback buttons
├─ Center: Memory Core / Behavior Identity Core
├─ Right: Behavior Genome + ML gene scores
└─ Bottom: Evolution Timeline + MCP Trace
```

## Visual Motifs to Copy

### Memory Core

- central glowing sphere/circle
- nested rings
- small particles orbiting
- labels: Signal, Gene, Mutation, Capsule

### MCP Trace

- animated beams between nodes:

```text
User -> Signal Extractor -> Bandit Policy -> EvoMap GEP -> Codex Worker
```

### Behavior Genome

- gene cards with glowing borders
- fitness bars
- selected gene gets animated border beam
- score deltas after feedback

### Evolution Timeline

- vertical or horizontal timeline
- each event card:

```text
Signal Detected
Gene Selected
Reward Calculated
Mutation Written
Capsule Candidate
```

## Palette

```text
background: #050512 / #080816
panel: rgba(255,255,255,0.04)
border: rgba(255,255,255,0.10)
primary purple: #8b5cf6
cyan: #22d3ee
mint: #5eead4
success: #34d399
warning: #f59e0b
negative: #fb7185
text main: #f8fafc
text muted: rgba(248,250,252,0.55)
```

## Design Rule

Do not make it look like a normal chatbot.

Every interaction must visually show:

```text
User feedback changes the assistant's future behavior.
```

## Implementation Priority

1. Use current `apps/web` as the cockpit shell.
2. Add real API calls to `/api/interactions/analyze` and `/api/feedback`.
3. Add animated Memory Core with CSS/framer-motion first.
4. Add gene cards + score bars.
5. Add timeline cards.
6. Add MCP trace beams last.


## EvoMap Official Website Style Lock

Reference: https://evomap.ai/

After visual review, EvoMate frontend should primarily follow EvoMap's own homepage language instead of generic cyber dashboard UI:

- almost pure black background
- thin challenge/banner bar at top
- minimal navbar
- giant radar/network rings behind hero
- centered oversized headline
- cyan emphasis word
- gray protocol/input pill
- compact right-side metric card
- sparse information density above the fold
- infrastructure/network feeling, not chatbot feeling

Implementation update:

```text
apps/web/app/page.tsx
```

The current first screen now mirrors EvoMap's hero composition while replacing the content with EvoMate-specific Yes Engineer / behavior evolution language.
