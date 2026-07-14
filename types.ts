/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AttendanceStatus = 'completed' | 'late' | 'excused' | 'missing';

export interface Person {
  id: string; // "p1" to "p25"
  name: string;
  role: string;
  phone: string;
  zone: string; // The specific area or village in Hubaish district (e.g., وادي ضبأ، العمارنة، جبل خضراء، إلخ)
  secretCode?: string;
}

export interface ReportEntry {
  status: AttendanceStatus;
  activity: string; // details of today's report
  notes: string; // any notes or problems
  timestamp?: string; // when it was entered
  isPendingApproval?: boolean;
  submittedBy?: 'coordinator' | 'admin';
}

export interface DailyReport {
  date: string; // YYYY-MM-DD
  entries: Record<string, ReportEntry>; // map of personId -> ReportEntry
}

export interface FieldActivity {
  id: string;
  title: string;
  category: 'meetings' | 'visits' | 'events' | 'courses' | 'cultural' | 'sports' | 'mobilization' | 'social' | 'administrative' | 'mawlid' | 'others';
  date: string;
  location: string; // عزلة / قرية في حبيش
  reporterId: string; // p1 - p25
  participantsCount: number;
  description: string;
  images: string[]; // array of base64 strings of the uploaded photos
  timestamp: string;
  isPendingApproval?: boolean;
  submittedBy?: 'coordinator' | 'admin';
}

export interface LoginLog {
  id: string;
  personId: string;
  name: string;
  role: string;
  zone: string;
  timestamp: string;
}

export interface BackupData {
  version: string;
  people: Person[];
  reports: DailyReport[];
  activities: FieldActivity[];
  officeName: string;
  districtName: string;
  logins?: LoginLog[];
}

