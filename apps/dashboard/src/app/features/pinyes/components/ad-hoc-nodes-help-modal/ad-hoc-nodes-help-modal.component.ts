import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';

@Component({
  selector: 'app-ad-hoc-nodes-help-modal',
  standalone: true,
  imports: [A11yModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ad-hoc-nodes-help-modal.component.html',
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class AdHocNodesHelpModalComponent {
  readonly open = input<boolean>(false);
  readonly closed = output<void>();

  onEscape(): void {
    if (this.open()) {
      this.closed.emit();
    }
  }

  close(): void {
    this.closed.emit();
  }
}
