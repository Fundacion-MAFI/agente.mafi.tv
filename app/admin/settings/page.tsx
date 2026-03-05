import { SettingsForm } from "./settings-form";

export default function AdminSettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-semibold text-2xl">Settings</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          System prompts, retrieval, embedding, chat, and entitlements.
        </p>
      </div>
      <SettingsForm />
    </div>
  );
}
