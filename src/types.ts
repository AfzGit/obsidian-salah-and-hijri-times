/** WGS84 coordinates in decimal degrees (north/east positive). */
export interface Coordinates { latitude: number; longitude: number }
/** Saved Iqama mode: disabled, a fixed 24-hour time, or minute offset from a base event. */
export type IqamaRule = { mode: "disabled" } | { mode: "fixed"; time: string } | { mode: "offset"; minutes: number; from?: "Fajr" | "Tahajjud" };
export interface CustomTime { name: string; time: string }
/** Per-event notification preferences; reached-time and advance messages are independent. */
export interface EventNotificationRule { reached: boolean; advance: boolean }
/** Persisted user configuration. New persisted fields must also be added to DEFAULTS. */
export interface Settings {
  coordinates: Coordinates | null;
  locationName: string;
  calculationMethod: number;
  hijriOffset: number;
  hijriRollover: "maghrib" | "midnight";
  calendarMonthStyle: "hijri" | "gregorian";
  refreshMinutes: number;
  statusTemplate: string;
  use24HourTime: boolean;
  statusBarVisible: boolean;
  notificationsEnabled: boolean;
  eventNotifications: Record<string, EventNotificationRule>;
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
  countdownNormalUsesTheme: boolean;
  customTimes: CustomTime[];
  iqama: Record<string, IqamaRule>;
}
/** One location/date calculation returned to the status bar, modals, and notifications. */
export interface Schedule {
  prayers: Array<{ name: string; time: string }>;
  hijriDate: string;
  hijriNumeric: string;
  hijriMonth: string;
  maghrib: string;
  locationName: string;
}
