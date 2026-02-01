# Esquema del model de dades

> **Sincronitzat amb [DATA_MODEL.md](./DATA_MODEL.md).** Actualitza aquest document cada vegada que es modifiquin entitats, camps o relacions al document principal.

---

## Resum d'entitats i relacions

| Entitat | Relacions principals |
|--------|------------------------|
| **User** | 1:N → Person; `role` (UserRole) |
| **Person** | N:1 → User; N:N → Position (via PersonPosition); N:N → MuixerangaEvent (via Attendance) |
| **Season** | 1:N → MuixerangaEvent |
| **MuixerangaEvent** | N:1 → Season; 1:N → MuixerangaEventSegment; 1:N → Attendance |
| **MuixerangaEventSegment** | N:1 → MuixerangaEvent (`eventId`); 1:N → FigureInstance |
| **Attendance** | N:1 → MuixerangaEvent, Person; `status` (AttendanceStatus) |
| **FigureTemplate** | `data`: FigureNode[]; 1:N → FigureInstance |
| **FigureInstance** | N:1 → FigureTemplate, MuixerangaEventSegment; `data`: InstanceData |
| **Position** | N:N → Person (via PersonPosition) |
| **PersonPosition** | N:1 → Person, Position |

---

## Tipus i unions

| Tipus | Valors |
|-------|--------|
| `UserRole` | `"user"` \| `"admin"` \| `"technical"` |
| `Gender` | `"male"` \| `"female"` \| `"other"` |
| `EventType` | `"rehearsal"` \| `"performance"` |
| `AttendanceStatus` | `"yes"` \| `"no"` \| `"maybe"` |
| `TemplateData` | `FigureNode[]` |
| `InstanceData` | Template nodes + `personId` assignat (mateix shape que `FigureNode[]`) |

---

## Definicions TypeScript (esquema actual)

```typescript
// --- Users & access ---
export type UserRole = "user" | "admin" | "technical";

export interface User {
  id: string; // PrimaryGeneratedColumn
  email: string;
  createdAt: Date;
  updatedAt: Date;
  role: UserRole;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
}

export type Gender = "male" | "female" | "other";

export interface Person {
  id: string;
  name: string;
  surname: string | null;
  alias: string | null;
  backHeight: number | null; // cm
  userId: string;
  birthDate: Date | null;
  mainAccountUser: boolean;
  gender: Gender | null;
}

// --- Seasons & events ---
export interface Season {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

export type EventType = "rehearsal" | "performance";

export interface MuixerangaEvent {
  id: string;
  type: EventType;
  seasonId: string | null;
  title: string | null;
  date: Date;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  cancelled: boolean;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  createdAt: Date;
}

export interface MuixerangaEventSegment {
  id: string;
  order: number;
  eventId: string;
}

export type AttendanceStatus = "yes" | "no" | "maybe";

export interface Attendance {
  id: string;
  eventId: string;
  personId: string;
  status: AttendanceStatus;
  updatedAt: Date;
}

// --- Figures ---
export interface FigureNode {
  id: string;
  label: string;
  color: string;
  shape: string;
  x: number;
  y: number;
  z: number;
  personId?: string;
}

export type TemplateData = FigureNode[];

export type InstanceData = FigureNode[]; // template nodes + assigned personId

export interface FigureTemplate {
  id: string;
  name: string;
  description: string | null;
  data: TemplateData;
  createdAt: Date;
  updatedAt: Date;
}

export interface FigureInstance {
  id: string;
  templateId: string;
  eventSegmentId: string;
  data: InstanceData;
  createdAt: Date;
  updatedAt: Date;
}

// --- Positions ---
export interface Position {
  id: string;
  name: string;
}

export interface PersonPosition {
  personId: string;
  positionId: string;
}
```

---

## Última sincronització

| Data | Amb DATA_MODEL.md |
|------|--------------------|
| 2025-02-01 | Season, MuixerangaEvent, MuixerangaEventSegment, Attendance; EventType, AttendanceStatus; User.id PrimaryGeneratedColumn |
