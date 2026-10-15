import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AlertCircle, AlertTriangle, CheckCircle, Info, LucideAngularModule, X, type LucideIconData } from 'lucide-angular';
import { ToastService, type ToastType } from '../../services/toast.service';
import { ButtonComponent } from '../button/button.component';

const ICONS: Record<ToastType, LucideIconData> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const ALERT_CLASSES: Record<ToastType, string> = {
  success: 'alert-success',
  error: 'alert-error',
  warning: 'alert-warning',
  info: 'alert-info',
};

@Component({
  selector: 'lib-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ButtonComponent],
  templateUrl: './toast-container.component.html',
  styleUrls: ['./toast-container.component.scss'],
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);

  protected readonly X = X;

  protected icon(type: ToastType): LucideIconData {
    return ICONS[type];
  }

  protected alertClass(type: ToastType): string {
    return ALERT_CLASSES[type];
  }
}
