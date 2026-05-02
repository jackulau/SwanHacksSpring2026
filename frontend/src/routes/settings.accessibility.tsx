import { createFileRoute } from "@tanstack/react-router";
import { A11yPanel } from "../components/accessibility/A11yPanel";

export const Route = createFileRoute("/settings/accessibility")({
  component: AccessibilityPage,
});

function AccessibilityPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <A11yPanel isOpen={true} onClose={() => {}} />
    </div>
  );
}
