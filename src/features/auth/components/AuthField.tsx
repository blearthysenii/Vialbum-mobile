import type { TextInputProps } from 'react-native';

import { TextField } from '@/components/ui/TextField';

type AuthFieldProps = TextInputProps & { label: string };

export function AuthField({ label, ...inputProps }: AuthFieldProps) {
  return <TextField label={label} {...inputProps} />;
}
