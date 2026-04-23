import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth/interceptors/auth.interceptor';
import { AuthService } from './core/auth/services/auth.service';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Clock,
  Construction,
  Eye,
  Home,
  Layers,
  Lock,
  Mail,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Star,
  UserX,
  Users,
} from 'lucide-angular';

const icons = {
  AlertCircle, AlertTriangle, ArrowLeft, Calendar, Check, ChevronDown,
  ChevronsUpDown, Clock, Construction, Eye, Home, Layers, Lock, Mail, Menu,
  MoreHorizontal, Plus, RefreshCw, Search, Settings, Star, UserX, Users,
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppInitializer(() => inject(AuthService).init()),
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useFactory: () => new LucideIconProvider(icons),
    },
  ],
};
