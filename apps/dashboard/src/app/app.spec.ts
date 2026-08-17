import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { allLucideIconsProvider } from '../testing/lucide-test-provider';
import { App } from './app';

@Component({ standalone: true, template: '' })
class StubComponent {}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: 'login', component: StubComponent },
          { path: 'forgot-password', component: StubComponent },
          { path: 'reset-password', component: StubComponent },
        ]),
        allLucideIconsProvider,
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

  it('hides the header and tab-nav on /login', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/login');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-header')).toBeNull();
  });

  it('hides the header and tab-nav on /forgot-password', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/forgot-password');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-header')).toBeNull();
  });

  it('hides the header and tab-nav on /reset-password', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/reset-password');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-header')).toBeNull();
  });
});
