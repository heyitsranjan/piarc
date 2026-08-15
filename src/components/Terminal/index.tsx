/**
 * @module components/Terminal
 * Terminal area — no tab bar (sidebar handles navigation).
 *
 * Shows the active tab's terminal pane. All tabs remain mounted
 * (display:none on inactive) so xterm.js and PTY processes stay alive
 * between sidebar clicks — switching is instant.
 */
import { useTerminalStore } from "@/store/terminal";

import TerminalEmpty from "./TerminalEmpty";
import TerminalTab from "./TerminalTab";

export default function TerminalArea() {
  const { tabs, activeTabId } = useTerminalStore();

  if (tabs.length === 0) return <TerminalEmpty />;

  return (
    <div className="flex-1 relative overflow-hidden bg-[var(--color-bg)]">
      {tabs.map((tab) => (
        <div key={tab.id} className="absolute inset-0">
          <TerminalTab tab={tab} isVisible={tab.id === activeTabId} />
        </div>
      ))}
    </div>
  );
}
