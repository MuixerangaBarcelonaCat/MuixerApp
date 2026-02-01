# Project Requirement Definition - Figures Designer

Document compartit per a la definició del model de dades.

> **Document incremental.** Anirem afegint i revisant contingut de forma col·laborativa; les seccions i entitats es poden ampliar o canviar segons el que es vagi acordant.

---

## Review tracker

| Reviewer    | Status      | Notes              |
|------------|-------------|--------------------|
| Adrián Abreu | Not started |                    |
| Laura de Luis | Not started |                    |
|             | Not started |                    |
|             | Under review |                    |
|             | Not started |                    |
|             | Not started |                    |
|             | Not started |                    |
|             | Not started |                    |
| Person      | Not started | agitoalex@gmail.com |

---

## Why?

We are committed to generate a functional app as per multiple reasons detailed here.

In order to tackle the green field we are decided to collaborate over an specific use-case: **designing a figure**.

---

## Escenari típic a l'assaig

1. Tècnica prepara figura "Micalet" per treballar avui
2. Assigna membres a cada posició (des de Dashboard)
3. Obre "Vista Projecció" en mode fullscreen
4. Projecta en pantalla gran (TV/projector)
5. Membres veuen on han d'anar:
   - A la pantalla gran (tots)
   - Al seu mòbil (individual)
6. Poden consultar-ho abans, durant i després de muntar

---

## How? Entity-First Design

To build a reliable system for the Muixeranga, we will first define the entities using TypeScript. We want to ensure that all technical requirements are aligned, as we are trying to gather them from outside.

### Users & access

To access the app we need users, this will be highly aligned with what better-auth provides. I'll omit the account part, which stores passwords and email.

```typescript
export interface User {
  id: string; // PrimaryGeneratedColumn
  email: string;
  createdAt: Date;
  updatedAt: Date;
  // Admin Plugin Properties
  role: UserRole;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
}

export type UserRole = "user" | "admin" | "technical";
```

**Rols:**

- **User:** Can log in, see rehearsals, say yes/no/maybe to a rehearsal, add persons to their account
- **Technical:** Create figure templates, edit people figure positions, create figure instances, add segments to event, edit future/current event segments
- **Admin:** See all users, ban users, force password resets, create seasons, add/edit rehearsals, everything technical does

Users have at least 1 "person" associated with it.

```typescript
export type Gender = "male" | "female" | "other";

export class Person {
  id: string;
  name: string;
  surname: string | null;
  alias: string | null;
  backHeight: number | null; // Measured in cm
  userId: string;
  birthDate: Date | null;
  mainAccountUser: boolean;
  gender: Gender | null;
}
```

### Seasons & events

Rehearsals are attached to a season. We need to know if a person will come or not so we can count with them in the figure (attendance). Rehearsals may have multiple figures running at the same time, so we divide events by segments.

```typescript
export interface Season {
  id: string;
  name: string; // e.g., "Temporada 2025-2026"
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
  startTime: string | null; // e.g., "19:30"
  endTime: string | null;
  location: string | null;
  cancelled: boolean;
  cancelledAt: Date | null;
  cancelledBy: string | null; // Links to User.id
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
  personId: string; // Crucial: Links to Person, not User
  status: AttendanceStatus;
  updatedAt: Date;
}
```

### Figures: templates & instances

Figures are considered as **templates** (e.g. Micalet, La Morera) that we can reuse.

```typescript
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

export interface FigureTemplate {
  id: string;
  name: string; // "Micalet"
  description: string | null;
  data: TemplateData; // Array of nodes with coords and colors
  createdAt: Date;
  updatedAt: Date;
}
```

We search through all available templates and reuse the structure above to create **an instance**:

```typescript
export interface FigureInstance {
  id: string;
  templateId: string;       // Points to "Micalet"
  eventSegmentId: string;   // Points to "Rehearsal Jan 31"
  data: InstanceData;       // The template nodes + assigned personId
  createdAt: Date;
  updatedAt: Date;
}
```

### Positions (search & assignment)

The technical team should be able to search people efficiently; the best way is to have people associated with positions.

```typescript
export interface Position {
  id: string;
  name: string; // The role name in Muixeranga terminology
}

export interface PersonPosition {
  personId: string;
  positionId: string;
}
```

---

## Summary

This model should be enough to cover the use case: tècnica prepara figura → assigna membres a posicions → projecció en pantalla gran i mòbil → consulta abans/durant/després de muntar.

---

## Últimes actualitzacions

| Data       | Qui / Què |
|-----------|------------|
| 2025-02-01 | Versió inicial: entitats User, Person, FigureTemplate, FigureInstance, Position, MuixerangaEventSegment |
| 2025-02-01 | Season, MuixerangaEvent, EventType, Attendance (AttendanceStatus); User.id PrimaryGeneratedColumn; Review tracker Under review |
