import { useEffect, useRef, useState, type ComponentProps, type SubmitEvent } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { HelpTopic } from "./login-helper";

interface LoginFormProps {
  onHelp: (topic: HelpTopic) => void;
  onEmailChange: () => void;
}

function PasswordInput({ error, ...props }: ComponentProps<typeof Input> & { error: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Input
        {...props}
        type={visible ? "text" : "password"}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "login-error" : undefined}
      />
      {Boolean(props.value) && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="password-toggle"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          disabled={props.readOnly}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      )}
    </>
  );
}

function SubmitButton({
  value,
  submitting,
  label,
}: {
  value: string;
  submitting: boolean;
  label: string;
}) {
  if (!value) return null;
  return (
    <Button
      type="submit"
      variant="ghost"
      size="icon"
      className="continue-button"
      aria-label={submitting ? "Signing in…" : label}
      disabled={submitting}
    >
      {submitting ? (
        <LoaderCircle className="loading-icon" aria-hidden="true" />
      ) : (
        <ArrowRight aria-hidden="true" />
      )}
    </Button>
  );
}

export function LoginForm({ onHelp, onEmailChange }: LoginFormProps) {
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!submitting) return;
    // A small local delay makes the demo feel real. No credentials leave this page.
    const timer = window.setTimeout(() => {
      setSubmitting(false);
      setPassword("");
      setError("Your email or password is incorrect. Please try again.");
      onHelp("offer");
      inputRef.current?.focus();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [submitting, onHelp]);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!fieldValue) return;
    if (step === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError("Please enter a valid email address.");
        inputRef.current?.focus();
        return;
      }
      setEmail(email.trim());
      setError("");
      setStep("password");
      return;
    }
    setError("");
    setSubmitting(true);
  }

  function changeEmail() {
    setStep("email");
    setPassword("");
    setError("");
    onEmailChange();
  }

  const isEmail = step === "email";
  const fieldValue = { email: email.trim(), password }[step];

  return (
    <section className="login-card" aria-labelledby="login-title">
      <h1 id="login-title" className="wordmark" aria-label="Carbon Zero">
        <span className="brand-symbol" aria-hidden="true" />
        <span>
          carbon zero<span className="wordmark-period">.</span>
        </span>
      </h1>

      <form onSubmit={submit} noValidate aria-busy={submitting}>
        {!isEmail && (
          <Button
            type="button"
            variant="ghost"
            className="email-back"
            onClick={changeEmail}
            disabled={submitting}
            aria-label={`Change email address, currently ${email}`}
          >
            <ArrowLeft aria-hidden="true" />
            <span>{email}</span>
          </Button>
        )}
        <div className="form-step" key={step}>
          <Label htmlFor={step}>{isEmail ? "Work email" : "Password"}</Label>
          <div className="input-wrap">
            {isEmail ? (
              <Input
                ref={inputRef}
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                maxLength={254}
                required
                spellCheck={false}
                autoCapitalize="none"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "login-error" : undefined}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
              />
            ) : (
              <PasswordInput
                ref={inputRef}
                id="password"
                name="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                required
                readOnly={submitting}
                className="password-input"
                error={error}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
              />
            )}
            <SubmitButton
              value={fieldValue}
              submitting={submitting}
              label={isEmail ? "Continue" : "Log in"}
            />
          </div>
          {error && (
            <p className="form-error" id="login-error" role="alert">
              <CircleAlert aria-hidden="true" />
              {error}
            </p>
          )}
          <Button
            type="button"
            variant="link"
            className="forgot-button"
            disabled={submitting}
            onClick={() => onHelp(isEmail ? "email" : "password")}
          >
            {isEmail ? "Forgot email?" : "Forgot password?"}
          </Button>
        </div>
      </form>
    </section>
  );
}
