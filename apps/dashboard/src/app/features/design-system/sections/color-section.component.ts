import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgClass } from '@angular/common';
import {
  buildCategoricalPalette,
  formatOklch,
  INK,
  PAPER,
  CREASE,
  SEMANTIC,
  SEMANTIC_LIGHT,
  ACCENT,
  ATTENDANCE_TONES,
  ATTENDANCE_TONES_DARK,
  GENDER_TONES,
  GENDER_TONES_DARK,
  heightRampTones,
} from '@muixer/ui';
import type { NodeTones } from '@muixer/ui';
import type { ThemeMode } from '@muixer/ui';
import type { InteractiveRole } from '@muixer/ui';

interface SemanticRoleSwatch {
  role: string;
  bgClass: string;
  contentClass: string;
}

interface FixedSwatch {
  label: string;
  hex: string;
}

const SEMANTIC_ROLES: SemanticRoleSwatch[] = [
  { role: 'primary', bgClass: 'bg-primary', contentClass: 'text-primary-content' },
  { role: 'secondary', bgClass: 'bg-secondary', contentClass: 'text-secondary-content' },
  { role: 'accent', bgClass: 'bg-accent', contentClass: 'text-accent-content' },
  { role: 'neutral', bgClass: 'bg-neutral', contentClass: 'text-neutral-content' },
  { role: 'info', bgClass: 'bg-info', contentClass: 'text-info-content' },
  { role: 'success', bgClass: 'bg-success', contentClass: 'text-success-content' },
  { role: 'warning', bgClass: 'bg-warning', contentClass: 'text-warning-content' },
  { role: 'error', bgClass: 'bg-error', contentClass: 'text-error-content' },
];

const SURFACE_ROLES: SemanticRoleSwatch[] = [
  { role: 'base-100', bgClass: 'bg-base-100', contentClass: 'text-base-content' },
  { role: 'base-200', bgClass: 'bg-base-200', contentClass: 'text-base-content' },
  { role: 'base-300', bgClass: 'bg-base-300', contentClass: 'text-base-content' },
];

const INTERACTIVE_ROLES: InteractiveRole[] = ['primary', 'secondary', 'accent', 'neutral', 'info', 'success', 'warning', 'error'];

const CATEGORICAL_LABELS = ['Red', 'Green', 'Blue', 'Gold', 'Purple', 'Orange', 'Teal', 'Pink', 'Brown', 'Olive'];

interface ToneSwatch {
  label: string;
  tones: NodeTones;
}

const HEIGHT_STEPS = [0, 0.25, 0.5, 0.75, 1];

@Component({
  selector: 'app-color-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  templateUrl: './color-section.component.html',
})
export class ColorSectionComponent {
  mode = input.required<ThemeMode>();

  protected readonly semanticRoles = SEMANTIC_ROLES;
  protected readonly surfaceRoles = SURFACE_ROLES;
  protected readonly interactiveRoles = INTERACTIVE_ROLES;

  protected readonly fixedScale: FixedSwatch[] = [
    { label: 'paper.white', hex: PAPER.white },
    { label: 'paper.cream', hex: PAPER.cream },
    { label: 'paper.ivory', hex: PAPER.ivory },
    { label: 'paper.washi', hex: PAPER.washi },
    { label: 'paper.washiDark', hex: PAPER.washiDark },
    { label: 'ink.black', hex: INK.black },
    { label: 'ink.dark', hex: INK.dark },
    { label: 'ink.mid', hex: INK.mid },
    { label: 'ink.light', hex: INK.light },
    { label: 'ink.faint', hex: INK.faint },
    { label: 'crease.light', hex: CREASE.light },
    { label: 'crease.mid', hex: CREASE.mid },
    { label: 'crease.dark', hex: CREASE.dark },
    { label: 'semantic.error', hex: SEMANTIC.error },
    { label: 'semantic.success', hex: SEMANTIC.success },
    { label: 'semantic.warning', hex: SEMANTIC.warning },
    { label: 'semantic.info', hex: SEMANTIC.info },
    { label: 'semanticLight.error', hex: SEMANTIC_LIGHT.error },
    { label: 'semanticLight.success', hex: SEMANTIC_LIGHT.success },
    { label: 'semanticLight.warning', hex: SEMANTIC_LIGHT.warning },
    { label: 'semanticLight.info', hex: SEMANTIC_LIGHT.info },
    { label: 'accent', hex: ACCENT },
  ];

  protected readonly categoricalSwatches = computed(() => {
    const palette = buildCategoricalPalette(this.mode());
    return palette.normal.map((color, i) => ({
      label: CATEGORICAL_LABELS[i],
      normal: formatOklch(color),
      light: formatOklch(palette.light[i]),
    }));
  });

  /** The segment workspace's display-mode tones (wash filled, pencil edge), in the mode on screen. */
  protected readonly displayModeGroups = computed<{ title: string; swatches: ToneSwatch[] }[]>(() => {
    const dark = this.mode() === 'dark';
    const gender = dark ? GENDER_TONES_DARK : GENDER_TONES;
    const attendance = dark ? ATTENDANCE_TONES_DARK : ATTENDANCE_TONES;
    return [
      { title: 'Gènere', swatches: (['female', 'male', 'other'] as const).map((g) => ({ label: g, tones: gender[g] })) },
      {
        title: 'Assistència (base / strong = next actuació)',
        swatches: (['success', 'warning', 'error'] as const).flatMap((t) => [
          { label: `${t}.base`, tones: attendance[t].base },
          { label: `${t}.strong`, tones: attendance[t].strong },
        ]),
      },
      { title: 'Alçada (heightRampTones, short → tall)', swatches: HEIGHT_STEPS.map((t) => ({ label: `t = ${t}`, tones: heightRampTones(t, this.mode()) })) },
    ];
  });

  protected stateVar(role: InteractiveRole, state: 'hover' | 'active' | 'disabled'): string {
    return `var(--ds-${role}-${state})`;
  }
}
