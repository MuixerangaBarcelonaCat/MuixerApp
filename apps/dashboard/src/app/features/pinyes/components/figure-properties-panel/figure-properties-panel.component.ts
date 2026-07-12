import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FigureMode } from '../../models/segment.model';

export interface FigurePropertiesEntry {
  id: string;
  label: string | null;
  figureTemplateName: string;
  figureMode: FigureMode;
  numberOfCordons: number | null;
  /** Highest rengla position among the figure's PINYA nodes; caps the cordons stepper. */
  maxCordons: number;
  /** Whether the figure template has a pinya at all — false means it's always neta (mode switcher hidden). */
  hasPinya: boolean;
  offsetX: number;
  offsetY: number;
  angle: number;
}

const MODE_OPTIONS: { value: FigureMode; label: string }[] = [
  { value: 'COMPLETA', label: 'Completa' },
  { value: 'PEU', label: 'Peu' },
  { value: 'REMAT', label: 'Remat' },
  { value: 'NETA', label: 'Neta' },
];

/**
 * Figure properties editor (name, mode, cordons, position, rotation),
 * shared by the composition editor and the segment workspace's Distribució
 * tab. All outputs carry the entry id so callers don't need to track which
 * entry is currently bound.
 */
@Component({
  selector: 'app-figure-properties-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './figure-properties-panel.component.html',
})
export class FigurePropertiesPanelComponent {
  readonly entry = input.required<FigurePropertiesEntry>();
  readonly showRemove = input(true);
  readonly modeOptions = MODE_OPTIONS;

  readonly labelChanged = output<{ id: string; value: string | null }>();
  readonly figureModeChanged = output<{ id: string; value: FigureMode }>();
  readonly numberOfCordonsChanged = output<{ id: string; value: number | null }>();
  readonly offsetXChanged = output<{ id: string; value: number }>();
  readonly offsetYChanged = output<{ id: string; value: number }>();
  readonly angleChanged = output<{ id: string; value: number }>();
  readonly removeRequested = output<string>();

  onLabelChange(value: string): void {
    this.labelChanged.emit({ id: this.entry().id, value: value.trim() ? value : null });
  }

  onFigureModeChange(value: FigureMode): void {
    this.figureModeChanged.emit({ id: this.entry().id, value });
  }

  /** 1 → 2 → … → maxCordons → Tots (null). No-op once at Tots. */
  onCordonsIncrement(): void {
    const { numberOfCordons, maxCordons } = this.entry();
    if (numberOfCordons === null) return;
    const next = numberOfCordons >= maxCordons ? null : numberOfCordons + 1;
    this.numberOfCordonsChanged.emit({ id: this.entry().id, value: next });
  }

  /** Tots (null) → maxCordons → … → 1. No-op once at 1. */
  onCordonsDecrement(): void {
    const { numberOfCordons, maxCordons } = this.entry();
    if (numberOfCordons === 1) return;
    const next = numberOfCordons === null ? maxCordons : numberOfCordons - 1;
    this.numberOfCordonsChanged.emit({ id: this.entry().id, value: next });
  }

  onOffsetXChange(value: string): void {
    this.offsetXChanged.emit({ id: this.entry().id, value: +value });
  }

  onOffsetYChange(value: string): void {
    this.offsetYChanged.emit({ id: this.entry().id, value: +value });
  }

  onAngleChange(value: string): void {
    this.angleChanged.emit({ id: this.entry().id, value: +value });
  }

  onRemove(): void {
    this.removeRequested.emit(this.entry().id);
  }
}
