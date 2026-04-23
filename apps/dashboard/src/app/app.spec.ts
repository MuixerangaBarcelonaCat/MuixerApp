import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  LUCIDE_ICONS, LucideIconProvider,
  AlertCircle, AlertTriangle, ArrowLeft, Calendar, Check, ChevronDown,
  ChevronsUpDown, Clock, Construction, Eye, Home, Layers, Lock, Mail, Menu,
  MoreHorizontal, Plus, RefreshCw, Search, Settings, Star, UserX, Users,
} from 'lucide-angular';
import { App } from './app';

const allIcons = {
  AlertCircle, AlertTriangle, ArrowLeft, Calendar, Check, ChevronDown,
  ChevronsUpDown, Clock, Construction, Eye, Home, Layers, Lock, Mail, Menu,
  MoreHorizontal, Plus, RefreshCw, Search, Settings, Star, UserX, Users,
};

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: LUCIDE_ICONS, multi: true, useFactory: () => new LucideIconProvider(allIcons) },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the app shell', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.nativeElement).toBeTruthy();
  });
});
