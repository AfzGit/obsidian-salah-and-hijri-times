export interface Coordinates { latitude: number; longitude: number }
export type IqamaRule = { mode: "disabled" } | { mode: "fixed"; time: string } | { mode: "offset"; minutes: number };
export interface CustomTime { name: string; time: string }
export interface Settings {
  coordinates: Coordinates | null;
  locationName: string;
  calculationMethod: number;
  hijriOffset: number;
  hijriRollover: "maghrib" | "midnight";
  refreshMinutes: number;
  statusTemplate: string;
  notificationsEnabled: boolean;
  notificationSound: boolean;
  notificationVolume: number;
  notifiedTimeKeys: string[];
  prayerReminderMinutes: number;
  iqamaReminderMinutes: number;
  countdownRedMinutes: number;
  countdownNormalMinutes: number;
  countdownRedColor: string;
  countdownOrangeColor: string;
  countdownNormalColor: string;
  customTimes: CustomTime[];
  iqama: Record<string, IqamaRule>;
}
export interface Schedule {
  prayers: Array<{ name: string; time: string }>;
  hijriDate: string;
  hijriNumeric: string;
  hijriMonth: string;
  maghrib: string;
  locationName: string;
}
