import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgClass } from '@angular/common';

interface FamilySample {
  label: string;
  tailwindClass: string;
  cssVar: string;
}

const FAMILIES: FamilySample[] = [
  { label: 'sans — Quicksand (global body default)', tailwindClass: 'font-sans', cssVar: 'FONT_FAMILY.sans' },
  { label: 'serif — Fraunces (display headings, not yet applied)', tailwindClass: 'font-serif', cssVar: 'FONT_FAMILY.serif' },
  { label: 'legible — Atkinson Hyperlegible Next (canvas labels, not yet applied)', tailwindClass: 'font-legible', cssVar: 'FONT_FAMILY.legible' },
];

interface SizeWeightSample {
  size: string;
  weight: string;
}

const SIZE_WEIGHTS: SizeWeightSample[] = [
  { size: 'text-sm', weight: 'font-normal' },
  { size: 'text-base', weight: 'font-normal' },
  { size: 'text-lg', weight: 'font-semibold' },
  { size: 'text-xl', weight: 'font-semibold' },
  { size: 'text-2xl', weight: 'font-bold' },
];

@Component({
  selector: 'app-typography-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  templateUrl: './typography-section.component.html',
})
export class TypographySectionComponent {
  protected readonly families = FAMILIES;
  protected readonly sizeWeights = SIZE_WEIGHTS;
}
