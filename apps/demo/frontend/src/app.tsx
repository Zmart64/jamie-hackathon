import { useCallback, useState } from "react";
import { LoginForm } from "./components/login-form";
import { type HelpTopic, LoginHelper } from "./components/login-helper";

export function App() {
  const [conversation, setConversation] = useState(0);
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
        <LoginForm
          onHelp={showHelp}
          onEmailChange={() => {
            setConversation((current) => current + 1);
            showHelp("welcome");
          }}
        />
      </main>

      <LoginHelper key={conversation} topic={help.topic} openRequest={help.sequence} />
    </div>
  );
}
