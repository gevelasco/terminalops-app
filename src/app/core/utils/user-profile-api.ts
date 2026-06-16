import type { UserMeResponse } from '@core/services/api/users';
import type { UserProfile } from '@core/models/user-profile.models';

export function mapUserMeToProfile(row: UserMeResponse): UserProfile {
  return {
    username: row.username.trim().toLowerCase(),
    displayName: row.displayName.trim(),
    jobTitle: row.jobTitle.trim(),
    email: row.email.trim(),
    phone: row.phone.trim(),
    photoDataUrl: row.photoDataUrl?.trim() ?? '',
    memberSince: row.memberSince,
    department: row.department.trim() || 'Gerencia',
    employeeId: String(row.employeeId ?? row.id),
    workLocation: row.workLocation.trim(),
  };
}

export function profileToPatchBody(
  patch: Partial<UserProfile> & {
    theme?: 'light' | 'dark';
    controlAutomaticRecognition?: boolean;
  },
): Record<string, string | boolean | undefined> {
  const body: Record<string, string | boolean | undefined> = {};
  if (patch.displayName !== undefined) {
    body['displayName'] = patch.displayName;
  }
  if (patch.username !== undefined) {
    body['username'] = patch.username;
  }
  if (patch.email !== undefined) {
    body['email'] = patch.email;
  }
  if (patch.phone !== undefined) {
    body['phone'] = patch.phone;
  }
  if (patch.jobTitle !== undefined) {
    body['jobTitle'] = patch.jobTitle;
  }
  if (patch.photoDataUrl !== undefined) {
    body['photoDataUrl'] = patch.photoDataUrl;
  }
  if (patch.theme !== undefined) {
    body['theme'] = patch.theme;
  }
  if (patch.controlAutomaticRecognition !== undefined) {
    body['controlAutomaticRecognition'] = patch.controlAutomaticRecognition;
  }
  return body;
}
