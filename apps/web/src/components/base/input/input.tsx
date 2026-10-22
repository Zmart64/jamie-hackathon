// Adapted from Untitled UI (MIT); see ../NOTICE.md. Labeled text fields only.
import type { LucideIcon } from "lucide-react";
import { Input as AriaInput } from "react-aria-components/Input";
import { TextField, type TextFieldProps } from "react-aria-components/TextField";
import { Label } from "react-aria-components/Label";

interface InputProps extends Omit<TextFieldProps, "children" | "className"> {
  label: string;
  placeholder?: string;
  icon?: LucideIcon;
}

export function Input({ label, placeholder = "", icon: Icon, ...props }: InputProps) {
  return (
    <TextField {...props} className="relative w-full">
      <Label className="sr-only">{label}</Label>
      {Icon && (
        <Icon
          aria-hidden="true"
          className="pointer-events-none absolute top-2.5 left-3 text-fg-quaternary"
        />
      )}
      <AriaInput
        placeholder={placeholder}
        className={`m-0 w-full rounded-lg bg-primary px-3 py-2 text-sm text-primary shadow-xs ring-1 ring-primary outline-brand ring-inset placeholder:text-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${Icon ? "pl-9" : ""}`}
      />
    </TextField>
  );
}
