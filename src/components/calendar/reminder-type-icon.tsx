'use client';

import {
  Gift,
  Star,
  Calendar,
  CheckCircle2,
  Stethoscope,
  Users,
  Pill,
  CreditCard,
  Receipt,
  House,
  FileText,
  ShieldCheck,
  StickyNote,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import type { ReminderType } from '@/hooks/use-reminders';
import { REMINDER_TYPE_ICONS, REMINDER_TYPE_ICON_BOX } from '@/lib/reminder-types';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  gift: Gift,
  star: Star,
  calendar: Calendar,
  'check-circle': CheckCircle2,
  stethoscope: Stethoscope,
  users: Users,
  pill: Pill,
  'credit-card': CreditCard,
  receipt: Receipt,
  house: House,
  'file-text': FileText,
  'shield-check': ShieldCheck,
  'sticky-note': StickyNote,
};

/**
 * آیکون دسته یادآور (تولد، جلسه، قبض، ...) — همه جای برنامه از همین استفاده می کند
 * تا آیکون هر دسته همه جا یکسان باشد.
 */
export function ReminderTypeIcon({
  type,
  className,
  boxed = false,
}: {
  type: ReminderType;
  className?: string;
  /** دور آیکون جعبه رنگی همان دسته بیفتد */
  boxed?: boolean;
}) {
  const Icon = ICONS[REMINDER_TYPE_ICONS[type]] ?? Bell;
  if (boxed) {
    return (
      <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0', REMINDER_TYPE_ICON_BOX[type])}>
        <Icon className={cn('h-5 w-5', className)} />
      </div>
    );
  }
  return <Icon className={className ?? 'h-4 w-4'} />;
}
