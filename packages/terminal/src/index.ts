export {
  TerminalCommandHandler,
  commandHandler,
  type CommandResult,
  type CommandContext,
  type CommandHandler,
  type Command,
} from "./command-handler";

export {
  CommandHistoryManager,
  commandHistory,
  type CommandHistoryEntry,
  type CommandHistoryData,
} from "./history";

// WS server excluded from compilation due to unresolvable dependencies
// export {
//   TerminalWSServer,
//   startWSServer,
//   getWSServer,
//   stopWSServer,
//   type WSMessage,
//   type WSServerOptions,
// } from "./ws-server";

export {
  TerminalSessionManager,
  type PTYSession,
} from "./session-manager";
