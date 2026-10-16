export function formatPricePerDay(price: number) {
  return `$${price % 1 === 0 ? price : price.toFixed(2)}/day`;
}

/** Time if the date is today, otherwise a short date (e.g. "Oct 9"). */
export function formatMessageTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** e.g. "Sep 2025" */
export function formatMonthYear(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', year: 'numeric' });
}

/** A YYYY-MM-DD date as e.g. "Fri, Oct 18". */
export function formatDay(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

/** An inclusive YYYY-MM-DD range as e.g. "Oct 18 – 19" or "Oct 18". */
export function formatDateRange(startDate: string, endDate: string) {
  const short = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' });
  return startDate === endDate ? short(startDate) : `${short(startDate)} – ${short(endDate)}`;
}

export function formatPrice(amount: number) {
  return `$${amount % 1 === 0 ? amount : amount.toFixed(2)}`;
}
