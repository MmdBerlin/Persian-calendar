/** Which official occasions produce notifications (stored in app settings). */
export interface EventNotifyPrefs {
  /** Official holidays of every category */
  holidays: boolean;
  shamsi: boolean;
  qamari: boolean;
  global: boolean;
  /** 0 = on the day, 1 = the day before */
  daysBefore: number;
  /** "HH:MM" */
  time: string;
}

export const DEFAULT_EVENT_NOTIFY: EventNotifyPrefs = {
  holidays: true,
  shamsi: false,
  qamari: false,
  global: false,
  daysBefore: 1,
  time: '20:00',
};
