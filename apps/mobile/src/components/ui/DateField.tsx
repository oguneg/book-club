import { TextField } from '@/components/ui/TextField';

// Native fallback: typed YYYY-MM-DD / HH:MM. The iOS step replaces this with the system date picker.
// The web version (DateField.web.tsx) uses the browser's own date and time inputs.

interface Props {
  label: string;
  /** YYYY-MM-DD (or HH:MM for kind="time"); empty string for none. */
  value: string;
  onChange: (value: string) => void;
  kind?: 'date' | 'time';
  hint?: string;
  error?: string;
}

export function DateField({ label, value, onChange, kind = 'date', hint, error }: Props) {
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={onChange}
      hint={hint ?? (kind === 'date' ? 'YYYY-MM-DD' : 'HH:MM')}
      error={error}
      inputMode="numeric"
      maxLength={kind === 'date' ? 10 : 5}
    />
  );
}
