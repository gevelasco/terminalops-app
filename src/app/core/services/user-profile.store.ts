import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import type { UserProfile } from '@core/models/user-profile.models';

const LS_PROFILE_PREFIX = 'terminalops.user-profile.';

export function profileStorageKey(username: string): string {
  return `${LS_PROFILE_PREFIX}${username.trim().toLowerCase()}`;
}

export function defaultUserProfile(username: string): UserProfile {
  const u = username.trim().toLowerCase();
  if (u === 'gvelasco') {
    return {
      username: 'gvelasco',
      displayName: 'Germán Velasco',
      jobTitle: 'Coordinador de operaciones',
      email: 'gvelasco@vsc.mx',
      phone: '+52 81 8000 1200',
      photoDataUrl: '',
      password: 'Admin123',
      memberSince: '2021-03-15',
      department: 'Operaciones logísticas',
      employeeId: 'VSC-0042',
      workLocation: 'Monterrey, NL',
    };
  }
  if (u === 'jlopez') {
    return {
      username: 'jlopez',
      displayName: 'Jessica López',
      jobTitle: 'Supervisor de monitoreo',
      email: 'jlopez@vsc.mx',
      phone: '+52 81 8000 1215',
      photoDataUrl: '',
      password: 'Admin123',
      memberSince: '2022-08-01',
      department: 'Torre de control',
      employeeId: 'VSC-0118',
      workLocation: 'Monterrey, NL',
    };
  }
  const label = u ? u.charAt(0).toUpperCase() + u.slice(1) : 'Usuario';
  return {
    username: u || 'usuario',
    displayName: label,
    jobTitle: 'Operador',
    email: u ? `${u}@terminalops.local` : 'usuario@terminalops.local',
    phone: '',
    photoDataUrl: '',
    password: 'Admin123',
    memberSince: new Date().toISOString().slice(0, 10),
    department: 'Operaciones',
    employeeId: '',
    workLocation: 'México',
  };
}

export function initialsFromDisplayName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  const compact = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.length >= 2) {
    return compact.slice(0, 2);
  }
  if (compact.length === 1) {
    return `${compact}·`;
  }
  return '??';
}

@Injectable({ providedIn: 'root' })
export class UserProfileStore {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly profileSig = signal<UserProfile | null>(null);

  readonly profile = this.profileSig.asReadonly();

  load(username: string): UserProfile {
    const key = profileStorageKey(username);
    let row: UserProfile | null = null;
    if (isPlatformBrowser(this.platformId)) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          row = JSON.parse(raw) as UserProfile;
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
    const merged: UserProfile = {
      ...defaultUserProfile(username),
      ...row,
      username: (row?.username ?? username).trim().toLowerCase(),
    };
    this.profileSig.set(merged);
    return merged;
  }

  save(profile: UserProfile): void {
    const normalized: UserProfile = {
      ...profile,
      username: profile.username.trim().toLowerCase(),
      displayName: profile.displayName.trim(),
      jobTitle: profile.jobTitle.trim(),
      email: profile.email.trim(),
      phone: profile.phone.trim(),
    };
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(
        profileStorageKey(normalized.username),
        JSON.stringify(normalized),
      );
    }
    this.profileSig.set(normalized);
  }

  passwordForUser(username: string): string {
    const current = this.profileSig();
    if (current?.username === username.trim().toLowerCase()) {
      return current.password;
    }
    return this.load(username).password;
  }

  clear(): void {
    this.profileSig.set(null);
  }
}
