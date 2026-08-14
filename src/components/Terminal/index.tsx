/**
 * @module components/Terminal
 * Terminal area: tab bar + one `TerminalTab` per open session.
 *
 * All tabs are mounted simultaneously (DOM nodes kept alive) so switching
 * between sessions is instant — no xterm.js or PTY recreation.
 *
 * Each `TerminalTab` internally handles its own loading / error / live / exited
 * state based on the `tab` object from the store.
 */
import { useTerminalStore } from "@/store/terminal";

import TabBar from "./TabBar";
import TerminalEmpty from "./TerminalEmpty";
import TerminalTab from "./TerminalTab";

export default function TerminalArea() {
  const { tabs, activeTabId } = useTerminalStore();

  if (tabs.length === 0) return <TerminalEmpty />;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0f0a14]">
      <TabBar />

      {/* All tabs mounted; only the active one is visible */}
      <div className="flex-1 relative overflow-hidden">
        {tabs.map((tab) => (
          <div key={tab.id} className="absolute inset-0">
            <TerminalTab tab={tab} isVisible={tab.id === activeTabId} />
          </div>
        ))}
      </div>
    </div>
  );
}
