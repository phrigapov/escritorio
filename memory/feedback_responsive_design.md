---
name: Responsive design rule
description: All UI must be responsive — desktop, tablet, mobile
type: feedback
---

All UI components must be responsive and work well on desktop, tablet, and mobile.

**Why:** User explicitly stated this as a system-wide design requirement.

**How to apply:** Use Tailwind responsive prefixes (sm:, md:, lg:) for layouts. Avoid fixed pixel widths in containers. Popovers/dropdowns must use collision avoidance and not overflow the screen. Two-column layouts should stack on small screens. Panels should resize gracefully.
