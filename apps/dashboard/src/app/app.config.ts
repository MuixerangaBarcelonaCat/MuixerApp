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
  AlignJustify,
  ArrowLeft,
  Calendar,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  Construction,
  Copy,
  Eye,
  Grid3X3,
  Home,
  LayoutGrid,
  Layers,
  Lock,
  Magnet,
  Mail,
  Menu,
  MoreHorizontal,
  MousePointer2,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shapes,
  Shield,
  Star,
  Tag,
  Trash2,
  UserCog,
  UserX,
  Users,
} from 'lucide-angular';

const icons = {
  AlertCircle, AlertTriangle, AlignJustify, ArrowLeft, Calendar, CalendarRange, Check,
  ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Clock, Construction, Copy, Eye,
  Grid3X3, Home, LayoutGrid, Layers, Lock, Magnet, Mail, Menu, MoreHorizontal, MousePointer2,
  PanelRightClose, PanelRightOpen, Pencil, Plus, RefreshCw, Search, Settings, Shapes, Shield,
  Star, Tag, Trash2, UserCog, UserX, Users,
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
