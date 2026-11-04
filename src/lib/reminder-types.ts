import type { ReminderType } from '@/hooks/use-reminders';

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  birthday: 'تولد',
  anniversary: 'سالگرد',
  event: 'مناسبت',
  task: 'کار',
  appointment: 'قرار ملاقات',
  meeting: 'جلسه',
  medicine: 'دارو',
  installment: 'قسط وام',
  bill: 'قبض',
  rent: 'اجاره',
  check: 'چک',
  insurance: 'بیمه',
  note: 'یادداشت',
};

export const REMINDER_TYPE_COLORS: Record<ReminderType, string> = {
  birthday: 'bg-pink-100 text-pink-700 border-pink-200',
  anniversary: 'bg-purple-100 text-purple-700 border-purple-200',
  event: 'bg-blue-100 text-blue-700 border-blue-200',
  task: 'bg-orange-100 text-orange-700 border-orange-200',
  appointment: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  meeting: 'bg-sky-100 text-sky-700 border-sky-200',
  medicine: 'bg-lime-100 text-lime-700 border-lime-200',
  installment: 'bg-red-100 text-red-700 border-red-200',
  bill: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  rent: 'bg-teal-100 text-teal-700 border-teal-200',
  check: 'bg-slate-100 text-slate-700 border-slate-200',
  insurance: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  note: 'bg-gray-100 text-gray-700 border-gray-200',
};

/** آیکون هر دسته: نام آیکون لوسید که در ReminderTypeIcon به کامپوننت تبدیل می شود */
export const REMINDER_TYPE_ICONS: Record<ReminderType, string> = {
  birthday: 'gift',
  anniversary: 'star',
  event: 'calendar',
  task: 'check-circle',
  appointment: 'stethoscope',
  meeting: 'users',
  medicine: 'pill',
  installment: 'credit-card',
  bill: 'receipt',
  rent: 'house',
  check: 'file-text',
  insurance: 'shield-check',
  note: 'sticky-note',
};

/** پس‌زمینه رنگی جعبه آیکون هر دسته */
export const REMINDER_TYPE_ICON_BOX: Record<ReminderType, string> = {
  birthday: 'bg-pink-100 text-pink-600',
  anniversary: 'bg-purple-100 text-purple-600',
  event: 'bg-blue-100 text-blue-600',
  task: 'bg-orange-100 text-orange-600',
  appointment: 'bg-indigo-100 text-indigo-600',
  meeting: 'bg-sky-100 text-sky-600',
  medicine: 'bg-lime-100 text-lime-600',
  installment: 'bg-red-100 text-red-600',
  bill: 'bg-yellow-100 text-yellow-700',
  rent: 'bg-teal-100 text-teal-600',
  check: 'bg-slate-100 text-slate-600',
  insurance: 'bg-cyan-100 text-cyan-600',
  note: 'bg-gray-100 text-gray-600',
};

export const REMINDER_TYPE_DOT_COLORS: Record<ReminderType, string> = {
  birthday: 'bg-pink-500',
  anniversary: 'bg-purple-500',
  event: 'bg-blue-500',
  task: 'bg-orange-500',
  appointment: 'bg-indigo-500',
  meeting: 'bg-sky-500',
  medicine: 'bg-lime-500',
  installment: 'bg-red-500',
  bill: 'bg-yellow-500',
  rent: 'bg-teal-500',
  check: 'bg-slate-500',
  insurance: 'bg-cyan-500',
  note: 'bg-gray-500',
};

/** Groups shown in the type dropdown of the reminder form. */
export const REMINDER_TYPE_GROUPS: { label: string; types: ReminderType[] }[] = [
  { label: 'مناسبت های شخصی', types: ['birthday', 'anniversary'] },
  { label: 'کارها و قرارها', types: ['event', 'task', 'appointment', 'meeting', 'medicine'] },
  { label: 'مالی', types: ['installment', 'bill', 'rent', 'check', 'insurance'] },
  { label: 'سایر', types: ['note'] },
];

/** What a new reminder of this type starts with (the user can change both in the form). */
export const REMINDER_TYPE_DEFAULTS: Record<
  ReminderType,
  { repeat: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'; offsets: number[] }
> = {
  birthday: { repeat: 'yearly', offsets: [0] },
  anniversary: { repeat: 'yearly', offsets: [0] },
  event: { repeat: 'none', offsets: [0] },
  task: { repeat: 'none', offsets: [0] },
  appointment: { repeat: 'none', offsets: [1, 0] },
  meeting: { repeat: 'none', offsets: [1, 0] },
  medicine: { repeat: 'daily', offsets: [0] },
  installment: { repeat: 'monthly', offsets: [3, 1, 0] },
  bill: { repeat: 'monthly', offsets: [3, 1, 0] },
  rent: { repeat: 'monthly', offsets: [3, 1, 0] },
  check: { repeat: 'none', offsets: [3, 1, 0] },
  insurance: { repeat: 'yearly', offsets: [7, 1, 0] },
  note: { repeat: 'none', offsets: [0] },
};

export interface ReminderHints {
  titleLabel: string;
  titlePlaceholder: string;
  titleHelp: string;
  /** Used in the notification preview while the title is empty */
  sampleTitle: string;
  /** Year field is shown only when this is set */
  yearLabel?: string;
  yearHelp?: string;
  descriptionPlaceholder: string;
}

/** Hint texts of the reminder form, one set per reminder type. */
export const REMINDER_TYPE_HINTS: Record<ReminderType, ReminderHints> = {
  birthday: {
    titleLabel: 'نام شخص',
    titlePlaceholder: 'مثلاً: علی',
    titleHelp: 'فقط اسم را بنویسید؛ نوتیف می شود «تولد علی».',
    sampleTitle: 'علی',
    yearLabel: 'سال تولد (اختیاری)',
    yearHelp: 'با وارد کردن سال تولد، در نوتیف سن فرد هم نوشته می شود.',
    descriptionPlaceholder: 'مثلاً: کادو بخرم، کیک سفارش بدهم',
  },
  anniversary: {
    titleLabel: 'سالگرد چه چیزی؟',
    titlePlaceholder: 'مثلاً: ازدواج',
    titleHelp: 'موضوع را بنویسید؛ نوتیف می شود «سالگرد ازدواج».',
    sampleTitle: 'ازدواج',
    yearLabel: 'سال شروع (اختیاری)',
    yearHelp: 'با وارد کردن سال شروع، تعداد سال ها در نوتیف نوشته می شود.',
    descriptionPlaceholder: 'مثلاً: رزرو رستوران، گل سفارش بدهم',
  },
  event: {
    titleLabel: 'عنوان مناسبت',
    titlePlaceholder: 'مثلاً: جلسه با مدیر پروژه',
    titleHelp: 'نام رویداد یا قرار را بنویسید.',
    sampleTitle: 'جلسه با مدیر پروژه',
    descriptionPlaceholder: 'مثلاً: ساعت ۱۰ صبح، دفتر مرکزی',
  },
  task: {
    titleLabel: 'کاری که باید انجام شود',
    titlePlaceholder: 'مثلاً: پرداخت قبض برق',
    titleHelp: 'کار را کوتاه و روشن بنویسید؛ نوتیف می گوید موعد انجامش رسیده.',
    sampleTitle: 'پرداخت قبض برق',
    descriptionPlaceholder: 'مثلاً: تا آخر وقت اداری، شناسه قبض ...',
  },
  appointment: {
    titleLabel: 'قرار با چه کسی / کجا؟',
    titlePlaceholder: 'مثلاً: دکتر احمدی',
    titleHelp: 'نوتیف می شود «قرار دکتر احمدی».',
    sampleTitle: 'دکتر احمدی',
    descriptionPlaceholder: 'مثلاً: ساعت ۱۶، مطب خیابان ولیعصر',
  },
  meeting: {
    titleLabel: 'جلسه برای چه چیزی؟',
    titlePlaceholder: 'مثلاً: جلسه هیئت مدیره',
    titleHelp: 'نوتیف می شود «جلسه هیئت مدیره»؛ یک روز قبل و خودش یادآوری می کند.',
    sampleTitle: 'جلسه هیئت مدیره',
    descriptionPlaceholder: 'مثلاً: ساعت ۱۰ صبح، اتاق جلسات شماره ۲',
  },
  medicine: {
    titleLabel: 'نام دارو',
    titlePlaceholder: 'مثلاً: قرص ویتامین D',
    titleHelp: 'برای مصرف روزانه، تکرار «روزانه» انتخاب شده؛ ساعت مصرف را پایین تنظیم کنید.',
    sampleTitle: 'قرص ویتامین D',
    descriptionPlaceholder: 'مثلاً: بعد از صبحانه، یک عدد',
  },
  installment: {
    titleLabel: 'نام وام',
    titlePlaceholder: 'مثلاً: وام مسکن بانک ملی',
    titleHelp: 'نوتیف می شود «قسط وام مسکن بانک ملی». تکرار ماهانه از پیش انتخاب شده است.',
    sampleTitle: 'وام مسکن بانک ملی',
    descriptionPlaceholder: 'مثلاً: مبلغ قسط، شماره حساب یا شعبه',
  },
  bill: {
    titleLabel: 'نوع قبض',
    titlePlaceholder: 'مثلاً: برق',
    titleHelp: 'نوتیف می شود «قبض برق». تکرار ماهانه از پیش انتخاب شده است.',
    sampleTitle: 'برق',
    descriptionPlaceholder: 'مثلاً: شناسه قبض و شناسه پرداخت',
  },
  rent: {
    titleLabel: 'اجاره چه چیزی؟',
    titlePlaceholder: 'مثلاً: خانه، دفتر کار',
    titleHelp: 'نوتیف می شود «اجاره خانه». تکرار ماهانه از پیش انتخاب شده است.',
    sampleTitle: 'خانه',
    descriptionPlaceholder: 'مثلاً: مبلغ، شماره کارت صاحب خانه',
  },
  check: {
    titleLabel: 'چک چه کسی / برای چه؟',
    titlePlaceholder: 'مثلاً: چک آقای رضایی',
    titleHelp: 'نوتیف می شود «سررسید چک آقای رضایی». تاریخ سررسید چک را وارد کنید.',
    sampleTitle: 'چک آقای رضایی',
    descriptionPlaceholder: 'مثلاً: مبلغ، شماره صیاد، بانک',
  },
  insurance: {
    titleLabel: 'نوع بیمه',
    titlePlaceholder: 'مثلاً: بیمه بدنه خودرو',
    titleHelp: 'نوتیف می شود «سررسید بیمه بدنه خودرو». تکرار سالانه از پیش انتخاب شده است.',
    sampleTitle: 'بیمه بدنه خودرو',
    descriptionPlaceholder: 'مثلاً: شماره بیمه نامه، شرکت بیمه',
  },
  note: {
    titleLabel: 'عنوان یادداشت',
    titlePlaceholder: 'مثلاً: کد تخفیف فروشگاه',
    titleHelp: 'عنوان کوتاه یادداشت؛ متن کامل را در توضیحات بنویسید.',
    sampleTitle: 'کد تخفیف فروشگاه',
    descriptionPlaceholder: 'متن یادداشت ...',
  },
};
