import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
};

/**
 * Splits a `YYYY-MM-DDTHH:mm` value into separate native date and time
 * inputs. Mobile browsers handle these reliably, unlike `datetime-local`.
 */
export function DateTimeField({ value, onChange, disabled, id }: Props) {
  const [datePart = "", timePart = ""] = value.split("T");

  const emit = (nextDate: string, nextTime: string) => {
    if (!nextDate && !nextTime) {
      onChange("");
      return;
    }
    const d = nextDate || new Date().toISOString().slice(0, 10);
    const t = nextTime || "09:00";
    onChange(`${d}T${t.slice(0, 5)}`);
  };

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type="date"
        className="min-h-11 flex-1 text-base sm:text-sm"
        disabled={disabled}
        value={datePart}
        onChange={(e) => emit(e.target.value, timePart)}
      />
      <Input
        type="time"
        className="min-h-11 w-[7.5rem] text-base sm:text-sm"
        disabled={disabled}
        value={timePart.slice(0, 5)}
        onChange={(e) => emit(datePart, e.target.value)}
      />
    </div>
  );
}
