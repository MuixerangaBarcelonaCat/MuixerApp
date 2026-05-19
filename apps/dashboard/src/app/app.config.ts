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
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Building2,
  Calendar,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Clock,
  Construction,
  Copy,
  ExternalLink,
  Eye,
  Grid3X3,
  Home,
  Keyboard,
  LayoutGrid,
  Layers,
  List,
  Lock,
  Magnet,
  Mail,
  Maximize2,
  Menu,
  Minus,
  MoreHorizontal,
  MousePointer2,
  MousePointerClick,
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
  X, Hexagon, EyeOff, FolderOpen, Info, GitBranch, HelpCircle, PlusCircle, UserCheck, Edit, Import
} from 'lucide-angular';

const icons = {
  AlertCircle, AlertTriangle, AlignJustify, ArrowDown, ArrowLeft, ArrowUp,
  Building2, Calendar, CalendarRange, Check,
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown,
  Clock, Construction, Copy, ExternalLink, Eye,
  Grid3X3, Home, Keyboard, LayoutGrid, Layers, List, Lock, Magnet, Mail, Maximize2, Menu, Minus,
  MoreHorizontal, MousePointer2, MousePointerClick,
  PanelRightClose, PanelRightOpen, Pencil, Plus, RefreshCw, Search, Settings, Shapes, Shield,
  Star, Tag, Trash2, UserCog, UserX, Users, X, Hexagon, EyeOff, FolderOpen, Info, GitBranch,
  HelpCircle, PlusCircle, UserCheck, Edit, Import
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
