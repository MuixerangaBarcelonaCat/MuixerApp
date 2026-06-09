import { Directive, HostListener, model } from '@angular/core';

export interface FloatingPanelPosition {
  x: number;
  y: number;
}

/**
 * Reusable drag behavior for floating panels (e.g. tronc overlay).
 * Attach to the panel host element and call `onDragStart` from the header's `(mousedown)`.
 *
 * @example
 * <div appFloatingPanelDrag [(position)]="troncPanelPos" [style.left.px]="troncPanelPos().x">
 *   <div class="drag-handle" (mousedown)="onDragStart($event)">...</div>
 * </div>
 */
@Directive({
  selector: '[appFloatingPanelDrag]',
  standalone: true,
  exportAs: 'appFloatingPanelDrag',
})
export class FloatingPanelDragDirective {
  readonly position = model<FloatingPanelPosition>({ x: 16, y: 60 });

  private dragging = false;
  private dragOffset = { x: 0, y: 0 };

  onDragStart(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('button')) return;
    this.dragging = true;
    const pos = this.position();
    this.dragOffset = { x: event.clientX - pos.x, y: event.clientY - pos.y };
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.dragging) return;
    this.position.set({
      x: event.clientX - this.dragOffset.x,
      y: event.clientY - this.dragOffset.y,
    });
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.dragging = false;
  }
}
