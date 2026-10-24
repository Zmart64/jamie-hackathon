import { useCallback, useState } from "react";
import { LoginForm } from "./components/login-form";
import { type HelpTopic, LoginHelper } from "./components/login-helper";

export function App() {
  const [help, setHelp] = useState<{ topic: HelpTopic; sequence: number }>({
    topic: "welcome",
    sequence: 0,
  });
  const showHelp = useCallback((topic: HelpTopic) => {
    setHelp((current) => ({ topic, sequence: current.sequence + 1 }));
  }, []);

  return (
    <div className="login-page">
      <main className="login-main">
        <LoginForm onHelp={showHelp} onEmailChange={() => showHelp("welcome")} />
      </main>

      <LoginHelper key={help.sequence} topic={help.topic} />
    </div>
  );
}
