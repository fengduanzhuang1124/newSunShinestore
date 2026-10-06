# Inventory operations UI master

Scope: management inventory operations only. The conditional inventory-master class isolates the presentation from the other management sections.

Changes:
- Compact page heading and flat navigation treatment while this section is selected.
- Local semantic colors, consistent spacing, quieter borders and button hierarchy.
- Compact metric strip with existing values and definitions.
- Native accessible disclosure for methodology and supporting inventory analysis; all existing lists and chart remain available.
- Existing table retained with numeric alignment, readable secondary text, bounded scrolling and result-range pagination.
- Mobile controls retain 44px targets and existing bottom navigation.
- Loading feedback uses the existing inventoryLoading state.

Component approach: finesse-ui product audit and shadcn composition conventions; existing Vue/native controls are reused. No official shadcn components, React, Tailwind, or new dependencies were installed.

Business lock: no script, API, database, inventory calculation, POS sync, permissions, query, sorting or pagination state changes. No mock data introduced.

Verification: frontend build (including vue-tsc) and existing 21 frontend tests passed. No lint script is configured. Live authenticated browser and mobile device visual validation remain outstanding.
